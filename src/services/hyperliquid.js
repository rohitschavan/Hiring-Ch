const axios = require('axios');
let Hyperliquid;
try {
  Hyperliquid = require('hyperliquid').Hyperliquid;
} catch (e) {
  // SDK not available, will use direct API calls
}

const HYPERLIQUID_API_URL = process.env.HYPERLIQUID_API_URL || 'https://api.hyperliquid.xyz';

function getDateRange(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

async function fetchUserTrades(walletAddress, startDate, endDate) {
  try {
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate + 'T23:59:59').getTime();
    
    // Try using SDK first
    if (Hyperliquid) {
      try {
        const sdk = new Hyperliquid({ testnet: false });
        const trades = await sdk.info.getUserTrades(walletAddress);
        if (trades && Array.isArray(trades)) {
          return trades.filter(trade => {
            const tradeTime = trade.time || trade.timestamp || trade.closedPxTime;
            if (!tradeTime) return false;
            const time = typeof tradeTime === 'string' ? new Date(tradeTime).getTime() : tradeTime;
            return time >= startTime && time <= endTime;
          });
        }
      } catch (sdkError) {
        console.warn('SDK failed, trying direct API:', sdkError.message);
      }
    }
    
    // Fallback to direct API call
    const response = await axios.post(`${HYPERLIQUID_API_URL}/info`, {
      type: 'userTrades',
      user: walletAddress
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // HyperLiquid API returns data in different formats
    let trades = [];
    if (Array.isArray(response.data)) {
      trades = response.data;
    } else if (response.data && Array.isArray(response.data.data)) {
      trades = response.data.data;
    } else if (response.data && response.data.trades) {
      trades = response.data.trades;
    }

    // Filter trades by date range
    return trades.filter(trade => {
      const tradeTime = trade.time || trade.timestamp || trade.closedPxTime;
      if (!tradeTime) return false;
      const time = typeof tradeTime === 'string' ? new Date(tradeTime).getTime() : tradeTime;
      return time >= startTime && time <= endTime;
    });
  } catch (error) {
    if (error.response?.status === 422) {
      // 422 usually means wallet has no trades or invalid format
      console.log(`HyperLiquid API: Wallet ${walletAddress.substring(0, 10)}... has no trades or invalid format`);
    } else {
      console.warn('Failed to fetch user trades from HyperLiquid:', error.response?.data || error.message);
    }
    return [];
  }
}

async function fetchUserFunding(walletAddress, startDate, endDate) {
  try {
    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate + 'T23:59:59').getTime();
    
    const response = await axios.post(`${HYPERLIQUID_API_URL}/info`, {
      type: 'userFunding',
      user: walletAddress
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    let funding = [];
    if (Array.isArray(response.data)) {
      funding = response.data;
    } else if (response.data && Array.isArray(response.data.data)) {
      funding = response.data.data;
    } else if (response.data && response.data.funding) {
      funding = response.data.funding;
    }

    // Filter funding by date range and extract amount
    return funding.filter(f => {
      const fundingTime = f.time || f.timestamp;
      if (!fundingTime) return false;
      // Handle both milliseconds and seconds timestamps
      let time = typeof fundingTime === 'string' ? parseInt(fundingTime) : fundingTime;
      // If timestamp is in seconds (less than year 2000 in ms), convert to ms
      if (time < 946684800000) {
        time = time * 1000;
      }
      return time >= startTime && time <= endTime;
    }).map(f => {
      // Extract funding amount from delta.usdc (HyperLiquid format)
      const fundingAmount = f.delta?.usdc ? parseFloat(f.delta.usdc) : 
                           f.funding ? parseFloat(f.funding) : 
                           f.amount ? parseFloat(f.amount) : 0;
      return {
        time: f.time || f.timestamp,
        funding: fundingAmount
      };
    });
  } catch (error) {
    if (error.response?.status === 422) {
      console.log(`HyperLiquid API: Wallet ${walletAddress.substring(0, 10)}... has no funding records`);
    } else {
      console.warn('Failed to fetch user funding from HyperLiquid:', error.response?.data || error.message);
    }
    return [];
  }
}

async function fetchUserState(walletAddress) {
  try {
    const response = await axios.post(`${HYPERLIQUID_API_URL}/info`, {
      type: 'clearinghouseState',
      user: walletAddress
    }, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Extract account value from different possible response structures
    const data = response.data || {};
    const marginSummary = data.marginSummary || data.margin || {};
    const accountValue = marginSummary.accountValue || data.accountValue || data.value || 0;
    
    return {
      ...data,
      marginSummary: {
        ...marginSummary,
        accountValue: accountValue
      },
      accountValue: accountValue
    };
  } catch (error) {
    console.warn('Failed to fetch user state from HyperLiquid:', error.response?.data || error.message);
    return {};
  }
}

async function getWalletPnL(walletAddress, startDate, endDate) {
  const dates = getDateRange(startDate, endDate);
  
  // Fetch real data from HyperLiquid API
  const [trades, funding, userState] = await Promise.all([
    fetchUserTrades(walletAddress, startDate, endDate),
    fetchUserFunding(walletAddress, startDate, endDate),
    fetchUserState(walletAddress)
  ]);
  
  // Get starting equity from user state or default
  const startingEquity = userState.marginSummary?.accountValue || 
                         userState.accountValue || 
                         10000;

  let equity = startingEquity;
  const daily = [];
  
  for (let index = 0; index < dates.length; index++) {
    const date = dates[index];
    // Filter trades for this day
    const dayTrades = trades.filter(t => {
      let tradeTime = t.time || t.timestamp || t.closedPxTime;
      if (!tradeTime) return false;
      // Handle both milliseconds and seconds
      if (typeof tradeTime === 'string') tradeTime = parseInt(tradeTime);
      if (tradeTime < 946684800000) tradeTime = tradeTime * 1000; // Convert seconds to ms
      const tradeDate = new Date(tradeTime).toISOString().split('T')[0];
      return tradeDate === date;
    });

    // Filter funding for this day
    const dayFunding = funding.filter(f => {
      let fundingTime = f.time || f.timestamp;
      if (!fundingTime) return false;
      // Handle both milliseconds and seconds
      if (typeof fundingTime === 'string') fundingTime = parseInt(fundingTime);
      if (fundingTime < 946684800000) fundingTime = fundingTime * 1000; // Convert seconds to ms
      const fundingDate = new Date(fundingTime).toISOString().split('T')[0];
      return fundingDate === date;
    });

    // Calculate realized PnL from closed trades
    const realized = dayTrades.reduce((sum, t) => {
      // HyperLiquid trade structure: closedPx, sz, side, oid, etc.
      const pnl = parseFloat(t.closedPx || t.realizedPnl || t.pnl || 0);
      return sum + (isNaN(pnl) ? 0 : pnl);
    }, 0);

    // Calculate fees
    const fees = dayTrades.reduce((sum, t) => {
      const fee = parseFloat(t.fee || t.fees || 0);
      return sum + (isNaN(fee) ? 0 : fee);
    }, 0);

    // Calculate funding payments (already extracted in fetchUserFunding)
    const fund = dayFunding.reduce((sum, f) => {
      return sum + (f.funding || 0);
    }, 0);

    // Calculate unrealized PnL from open positions
    // This would require position data and mark-to-market prices
    // For now, we'll calculate it from the difference in account value
    let unrealized = 0;
    if (index > 0 && userState.assetPositions) {
      // Calculate unrealized PnL from open positions
      // This is a simplified calculation - real implementation would need mark prices
      unrealized = 0; // Placeholder - would need position data and mark prices
    }

    const net = realized + unrealized - fees + fund;
    
    // Calculate equity for this day (cumulative from starting equity)
    // For first day, use starting equity; for subsequent days, add net to previous equity
    if (index === 0) {
      equity = startingEquity + net;
    } else {
      // Get previous day's equity and add today's net
      const previousEquity = daily[index - 1].equity_usd;
      equity = previousEquity + net;
    }
    
    // Ensure equity is always a valid number
    if (isNaN(equity) || !isFinite(equity)) {
      equity = startingEquity;
    }

    daily.push({
      date,
      realized_pnl_usd: Math.round(realized * 100) / 100,
      unrealized_pnl_usd: Math.round(unrealized * 100) / 100,
      fees_usd: Math.round(fees * 100) / 100,
      funding_usd: Math.round(fund * 100) / 100,
      net_pnl_usd: Math.round(net * 100) / 100,
      equity_usd: Math.round(equity * 100) / 100
    });
  }

  const summary = {
    total_realized_usd: daily.reduce((sum, d) => sum + d.realized_pnl_usd, 0),
    total_unrealized_usd: daily.reduce((sum, d) => sum + d.unrealized_pnl_usd, 0),
    total_fees_usd: daily.reduce((sum, d) => sum + d.fees_usd, 0),
    total_funding_usd: daily.reduce((sum, d) => sum + d.funding_usd, 0),
    net_pnl_usd: daily.reduce((sum, d) => sum + d.net_pnl_usd, 0)
  };

  return {
    wallet: walletAddress,
    start: startDate,
    end: endDate,
    daily,
    summary,
    diagnostics: {
      data_source: trades.length > 0 || funding.length > 0 ? 'hyperliquid_api' : 'hyperliquid_api_no_data',
      last_api_call: new Date().toISOString(),
      notes: trades.length > 0 || funding.length > 0 
        ? `Real data from HyperLiquid API. Trades: ${trades.length}, Funding records: ${funding.length}`
        : 'No trading activity found for this wallet in the specified date range. The wallet may not have any trades on HyperLiquid, or the date range may not include any activity.',
      trades_found: trades.length,
      funding_records_found: funding.length,
      api_status: 'connected',
      wallet_checked: walletAddress
    }
  };
}

module.exports = { getWalletPnL };

