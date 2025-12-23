const axios = require('axios');

const API_URL = process.env.COINGECKO_API_URL || 'https://api.coingecko.com/api/v3';

async function getTokenData(tokenId, vsCurrency = 'usd', historyDays = null) {
  try {
    // Step 1: Fetch token metadata & market data from /coins/{id}
    const response = await axios.get(`${API_URL}/coins/${tokenId}`, {
      params: { localization: false, tickers: false, market_data: true, community_data: false, developer_data: false }
    });

    const data = response.data;
    const md = data.market_data;

    const tokenData = {
      id: data.id,
      symbol: data.symbol,
      name: data.name,
      market_data: {
        current_price_usd: md?.current_price?.[vsCurrency] || 0,
        market_cap_usd: md?.market_cap?.[vsCurrency] || 0,
        total_volume_usd: md?.total_volume?.[vsCurrency] || 0,
        price_change_percentage_24h: md?.price_change_percentage_24h_in_currency?.[vsCurrency] || 0,
        price_change_percentage_7d: md?.price_change_percentage_7d_in_currency?.[vsCurrency] || 0,
        price_change_percentage_30d: md?.price_change_percentage_30d_in_currency?.[vsCurrency] || 0
      }
    };

    // Step 1 (optional): Fetch historical data from /market_chart if historyDays provided
    if (historyDays) {
      try {
        const historyResponse = await axios.get(`${API_URL}/coins/${tokenId}/market_chart`, {
          params: {
            vs_currency: vsCurrency,
            days: historyDays
          }
        });
        tokenData.historical_data = historyResponse.data;
      } catch (error) {
        console.warn(`Failed to fetch historical data: ${error.message}`);
      }
    }

    return tokenData;
  } catch (error) {
    if (error.response?.status === 404) {
      throw new Error(`Token '${tokenId}' not found`);
    }
    throw new Error(`Failed to fetch token data: ${error.message}`);
  }
}

module.exports = { getTokenData };

