# Token Insight & Analytics API

A backend service that provides token insights using AI analysis and HyperLiquid wallet PnL tracking.

## Features

- **Token Insight API**: Fetches token data from CoinGecko and generates AI-powered insights
- **HyperLiquid Wallet PnL API**: Calculates daily Profit and Loss for HyperLiquid wallets

## Tech Stack

- **Backend**: Node.js/Express
- **Market Data**: CoinGecko API (free, no API key required)
- **AI**: OpenAI GPT-4o-mini or Hugging Face (configurable)

## Prerequisites

- Node.js 18+ or Docker
- OpenAI API key (optional, falls back to mock responses if not provided)

## Setup Instructions

### Option 1: Docker (Recommended)

1. Clone the repository:
```bash
git clone <repo-url>
cd "Hiring Ch"
```

2. Create a `.env` file:
```bash
cp .env.example .env
```

3. Edit `.env` and add your API keys:
```env
PORT=3000
NODE_ENV=development
OPENAI_API_KEY=your_openai_api_key_here
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
```

4. Build and run with Docker Compose:
```bash
docker-compose up --build
```

The API will be available at `http://localhost:3000`

### Option 2: Local Development

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file (see above)

3. Run the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

## API Endpoints

### 1. Token Insight API

**Endpoint**: `POST /api/token/:id/insight`

Fetches token data from CoinGecko and generates AI-powered insights.

**Request**:
```bash
curl -X POST http://localhost:3000/api/token/chainlink/insight \
  -H "Content-Type: application/json" \
  -d '{
    "vs_currency": "usd",
    "history_days": 30
  }'
```

**Response**:
```json
{
  "source": "coingecko",
  "token": {
    "id": "chainlink",
    "symbol": "link",
    "name": "Chainlink",
    "market_data": {
      "current_price_usd": 7.23,
      "market_cap_usd": 3500000000,
      "total_volume_usd": 120000000,
      "price_change_percentage_24h": -1.2
    }
  },
  "insight": {
    "reasoning": "Generic market comment",
    "sentiment": "Neutral"
  },
  "model": {
    "provider": "openai",
    "model": "gpt-4o-mini"
  }
}
```

### 2. HyperLiquid Wallet PnL API

**Endpoint**: `GET /api/hyperliquid/:wallet/pnl?start=YYYY-MM-DD&end=YYYY-MM-DD`

Calculates daily Profit and Loss for a HyperLiquid wallet.

**Request**:
```bash
curl "http://localhost:3000/api/hyperliquid/0xabc123.../pnl?start=2025-08-01&end=2025-08-03"
```

**Response**:
```json
{
  "wallet": "0xabc123...",
  "start": "2025-08-01",
  "end": "2025-08-03",
  "daily": [
    {
      "date": "2025-08-01",
      "realized_pnl_usd": 120.5,
      "unrealized_pnl_usd": -15.3,
      "fees_usd": 2.1,
      "funding_usd": -0.5,
      "net_pnl_usd": 102.6,
      "equity_usd": 10102.6
    }
  ],
  "summary": {
    "total_realized_usd": 120.5,
    "total_unrealized_usd": -25.3,
    "total_fees_usd": 3.3,
    "total_funding_usd": -0.8,
    "net_pnl_usd": 91.1
  },
  "diagnostics": {
    "data_source": "hyperliquid_api",
    "last_api_call": "2025-09-22T12:00:00Z",
    "notes": "PnL calculated using daily close prices"
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `HUGGINGFACE_API_KEY` | Hugging Face API key | - |
| `AI_PROVIDER` | AI provider (`openai` or `huggingface`) | `openai` |
| `AI_MODEL` | AI model name | `gpt-4o-mini` |
| `COINGECKO_API_URL` | CoinGecko API URL | `https://api.coingecko.com/api/v3` |
| `HYPERLIQUID_API_URL` | HyperLiquid API URL | `https://api.hyperliquid.xyz` |


