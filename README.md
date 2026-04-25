# Polymarket Data API — x402 Powered

Real-time Polymarket prediction market data. No API keys. Pay per request in USDC on Base mainnet.

## Endpoints

| Endpoint | Price | Description |
|---|---|---|
| `GET /markets` | $0.001 | Top active markets, filterable |
| `GET /market/:conditionId` | $0.002 | Single market full detail |
| `GET /orderbook/:tokenId` | $0.005 | Live bids/asks + spread |
| `GET /prices?tokens=id1,id2` | $0.003 | Bulk midpoint prices |
| `GET /events` | $0.001 | Top events with nested markets |
| `GET /` | FREE | API docs + health check |

## Deploy to Vercel

### 1. Clone & configure

```bash
git clone <your-repo>
cd polymarket-data-api
```

### 2. Set env var in Vercel dashboard

```
WALLET_ADDRESS=0xf5fF2Cb593bcd029fd4Aae049109a9Cc205D5baF
```

### 3. Deploy

```bash
npm i -g vercel
vercel --prod
```

Vercel free tier elég — serverless function, nincs szerver cost.

## List on agentic.market

1. Menj: https://agentic.market/submit (vagy a Submit gomb)
2. Töltsd ki:
   - **Name**: Polymarket Data API
   - **URL**: https://your-app.vercel.app
   - **Category**: Data
   - **Description**: Real-time Polymarket prediction market data — markets, orderbooks, prices, events. No API key needed, pay per request via x402 in USDC on Base.
   - **Price range**: $0.001–$0.005 per request
3. A `/` endpoint visszaad egy JSON docs-ot amit az agentic.market felhasználhat autodiscovery-hez

## Query examples

```bash
# Markets
curl https://your-app.vercel.app/markets

# Specific market
curl https://your-app.vercel.app/market/0xabc123...

# Orderbook
curl https://your-app.vercel.app/orderbook/<tokenId>

# Bulk prices
curl "https://your-app.vercel.app/prices?tokens=id1,id2,id3"

# Events
curl https://your-app.vercel.app/events?limit=5
```

(x402-kompatibilis kliens nélkül 402-t kapsz vissza — ez helyes viselkedés)

## Local dev

```bash
npm install
WALLET_ADDRESS=0xf5fF... node api/index.js
```
