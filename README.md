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
        "id": "ethereum",
        "symbol": "eth",
        "name": "Ethereum",
        "market_data": {
            "current_price_usd": 2942.25,
            "market_cap_usd": 354820475362,
            "total_volume_usd": 21379793486,
            "price_change_percentage_24h": -1.19249,
            "price_change_percentage_7d": -0.5184,
            "price_change_percentage_30d": 4.90556
        }
    },
    "insight": {
        "reasoning": "Ethereum's market performance is mixed, with a recent decline in price (-1.19249% 24h change) but a positive 30-day change (4.90556%) indicating overall growth. The 7-day change (-0.5184%) shows a slight decline. Considering the market capitalization and 24-hour trading volume, Ethereum remains a significant player in the cryptocurrency market.",
        "sentiment": "Neutral"
    },
    "model": {
        "provider": "huggingface",
        "model": "meta-llama/Meta-Llama-3-8B-Instruct"
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
    "wallet": "0x0ddf9bae2af4b874b96d287a5ad42eb47138a902",
    "start": "2025-12-23",
    "end": "2025-12-24",
    "daily": [
        {
            "date": "2025-12-23",
            "realized_pnl_usd": 0,
            "unrealized_pnl_usd": 0,
            "fees_usd": 0,
            "funding_usd": -17500.02,
            "net_pnl_usd": -17500.02,
            "equity_usd": 39344107.06
        },
        {
            "date": "2025-12-24",
            "realized_pnl_usd": 0,
            "unrealized_pnl_usd": 0,
            "fees_usd": 0,
            "funding_usd": -18508.62,
            "net_pnl_usd": -18508.62,
            "equity_usd": 39325598.44
        }
    ],
    "summary": {
        "total_realized_usd": 0,
        "total_unrealized_usd": 0,
        "total_fees_usd": 0,
        "total_funding_usd": -36008.64,
        "net_pnl_usd": -36008.64
    },
    "diagnostics": {
        "data_source": "hyperliquid_api",
        "last_api_call": "2025-12-24T18:42:27.959Z",
        "trades_found": 0,
        "funding_records_found": 283,
        "api_status": "connected"
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


NOTE ---- 
HyperLiquid does not expose historical unrealized PnL snapshots.
This service calculates unrealized PnL using current mark prices from
clearinghouseState. Historical unrealized values are approximated via
mark-to -market methodology.