const axios = require('axios');

let Hyperliquid;
try {
  Hyperliquid = require('hyperliquid').Hyperliquid;
} catch (e) {
  // SDK optional
}

const HYPERLIQUID_API_URL = process.env.HYPERLIQUID_API_URL || 'https://api.hyperliquid.xyz';
const COINGECKO_API = 'https://api.coingecko.com/api/v3';

/**
 * Map HyperLiquid coin symbol CoinGecko ID
 */
const COIN_MAP = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana'
};

/* HELPERS  */

function getDateRange(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

function normalizeTimestamp(ts) {
  if (!ts) return null;
  let time = typeof ts === 'string' ? parseInt(ts) : ts;
  if (time < 946684800000) time *= 1000; // seconds → ms
  return time;
}

/* PRICE FETCH */

async function fetchDailyClosePrices(coin, startDate, endDate) {
  const id = COIN_MAP[coin];
  if (!id) return {};

  const from = Math.floor(new Date(startDate).getTime() / 1000);
  const to = Math.floor(new Date(endDate).getTime() / 1000);

  const { data } = await axios.get(
    `${COINGECKO_API}/coins/${id}/market_chart/range`,
    {
      params: {
        vs_currency: 'usd',
        from,
        to
      }
    }
  );

  const daily = {};
  for (const [ts, price] of data.prices) {
    const day = new Date(ts).toISOString().split('T')[0];
    daily[day] = price; // last price = daily close
  }

  return daily;
}

/* HYPERLIQUID FETCHERS  */

async function fetchUserTrades(wallet) {
  try {
    if (Hyperliquid) {
      const sdk = new Hyperliquid({ testnet: false });
      return await sdk.info.getUserTrades(wallet);
    }
  } catch (_) {}

  try {
    const res = await axios.post(`${HYPERLIQUID_API_URL}/info`, {
      type: 'userTrades',
      user: wallet
    });
    return res.data || [];
  } catch {
    return [];
  }
}

async function fetchUserFunding(wallet) {
  try {
    const res = await axios.post(`${HYPERLIQUID_API_URL}/info`, {
      type: 'userFunding',
      user: wallet
    });
    return res.data || [];
  } catch {
    return [];
  }
}

async function fetchUserState(wallet) {
  try {
    const res = await axios.post(`${HYPERLIQUID_API_URL}/info`, {
      type: 'clearinghouseState',
      user: wallet
    });

    const data = res.data || {};
    const margin = data.marginSummary || {};
    return {
      assetPositions: data.assetPositions || [],
      accountValue: Number(margin.accountValue || data.accountValue || 0)
    };
  } catch {
    return { assetPositions: [], accountValue: 0 };
  }
}

/* MAIN SERVICE */

async function getWalletPnL(wallet, startDate, endDate) {
  const dates = getDateRange(startDate, endDate);

  const [trades, funding, state] = await Promise.all([
    fetchUserTrades(wallet),
    fetchUserFunding(wallet),
    fetchUserState(wallet)
  ]);

  const startingEquity = state.accountValue || 10000;
  let equity = startingEquity;

  const positions = state.assetPositions || [];

  /* Fetch prices ONCE per coin*/
  const priceMap = {};
  for (const pos of positions) {
    if (!priceMap[pos.coin]) {
      priceMap[pos.coin] = await fetchDailyClosePrices(
        pos.coin,
        startDate,
        endDate
      );
    }
  }

  const daily = [];

  for (let i = 0; i < dates.length; i++) {
    const date = dates[i];

    /* Trades*/
    const dayTrades = trades.filter(t => {
      const ts = normalizeTimestamp(t.time || t.timestamp || t.closedPxTime);
      if (!ts) return false;
      return new Date(ts).toISOString().split('T')[0] === date;
    });

    const realized = dayTrades.reduce(
      (s, t) => s + Number(t.realizedPnl || t.pnl || 0),
      0
    );

    const fees = dayTrades.reduce(
      (s, t) => s + Number(t.fee || 0),
      0
    );

    /*Funding */
    const dayFunding = funding.filter(f => {
      const ts = normalizeTimestamp(f.time || f.timestamp);
      if (!ts) return false;
      return new Date(ts).toISOString().split('T')[0] === date;
    });

    const fundingUsd = dayFunding.reduce(
      (s, f) => s + Number(f.delta?.usdc || f.funding || 0),
      0
    );

    /* Unrealized PnL */
    let unrealized = 0;
    for (const pos of positions) {
      const size = Number(pos.szi);
      const entry = Number(pos.entryPx);
      const close = priceMap[pos.coin]?.[date];

      if (!size || !entry || !close) continue;
      unrealized += size * (close - entry);
    }

    const net = realized + unrealized - fees + fundingUsd;
    equity = i === 0 ? startingEquity + net : daily[i - 1].equity_usd + net;

    daily.push({
      date,
      realized_pnl_usd: +realized.toFixed(2),
      unrealized_pnl_usd: +unrealized.toFixed(2),
      fees_usd: +fees.toFixed(2),
      funding_usd: +fundingUsd.toFixed(2),
      net_pnl_usd: +net.toFixed(2),
      equity_usd: +equity.toFixed(2)
    });
  }

  const summary = {
    total_realized_usd: +daily.reduce((s, d) => s + d.realized_pnl_usd, 0).toFixed(2),
    total_unrealized_usd: +daily.reduce((s, d) => s + d.unrealized_pnl_usd, 0).toFixed(2),
    total_fees_usd: +daily.reduce((s, d) => s + d.fees_usd, 0).toFixed(2),
    total_funding_usd: +daily.reduce((s, d) => s + d.funding_usd, 0).toFixed(2),
    net_pnl_usd: +daily.reduce((s, d) => s + d.net_pnl_usd, 0).toFixed(2)
  };

  return {
    wallet,
    start: startDate,
    end: endDate,
    daily,
    summary,
    diagnostics: {
      data_source: trades.length || funding.length ? 'hyperliquid_api' : 'hyperliquid_api_no_data',
      last_api_call: new Date().toISOString(),
      trades_found: trades.length,
      funding_records_found: funding.length,
      api_status: 'connected'
    }
  };
}

module.exports = { getWalletPnL };
