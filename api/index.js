import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

const app = express();
app.use(express.json());

const GAMMA = "https://gamma-api.polymarket.com";
const CLOB = "https://clob.polymarket.com";
const WALLET = process.env.WALLET_ADDRESS;

if (!WALLET) throw new Error("WALLET_ADDRESS env var is required");

const facilitator = new HTTPFacilitatorClient({ url: "https://x402.org/facilitator" });
const resourceServer = new x402ResourceServer(facilitator).register("eip155:8453", new ExactEvmScheme());

const makeAccepts = (price) => ({
  scheme: "exact",
  price,
  network: "eip155:8453",
  payTo: WALLET,
});

app.use(
  paymentMiddleware(
    {
      "GET /markets": {
        accepts: makeAccepts("$0.001"),
        description: "Top active Polymarket prediction markets with prices and volume",
        mimeType: "application/json",
      },
      "GET /market/:id": {
        accepts: makeAccepts("$0.002"),
        description: "Full details for a single Polymarket market by condition ID",
        mimeType: "application/json",
      },
      "GET /orderbook/:tokenId": {
        accepts: makeAccepts("$0.005"),
        description: "Live orderbook (bids/asks) for a Polymarket token",
        mimeType: "application/json",
      },
      "GET /prices": {
        accepts: makeAccepts("$0.003"),
        description: "Bulk midpoint prices for multiple token IDs (comma-separated)",
        mimeType: "application/json",
      },
      "GET /events": {
        accepts: makeAccepts("$0.001"),
        description: "Top Polymarket events with nested markets",
        mimeType: "application/json",
      },
    },
    resourceServer
  )
);

async function polyFetch(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Upstream error ${res.status}`);
  return res.json();
}

// GET /markets?limit=20&tag=crypto&sort=volume24hr
app.get("/markets", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const tag = req.query.tag || "";
    const sort = req.query.sort || "volume24hr";
    const active = req.query.active !== "false";

    let url = `${GAMMA}/markets?limit=${limit}&active=${active}&order=${sort}&ascending=false`;
    if (tag) url += `&tag=${encodeURIComponent(tag)}`;

    const data = await polyFetch(url);
    const markets = (Array.isArray(data) ? data : data.data || []).map((m) => ({
      id: m.conditionId,
      slug: m.slug,
      question: m.question,
      outcomes: m.outcomes,
      outcomePrices: m.outcomePrices,
      volume24hr: m.volume24hr,
      liquidity: m.liquidity,
      endDate: m.endDate,
      active: m.active,
      closed: m.closed,
      enableOrderBook: m.enableOrderBook,
    }));

    res.json({ count: markets.length, markets, _paid: "$0.001 USDC / Base mainnet" });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /market/:id
app.get("/market/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const data = await polyFetch(`${GAMMA}/markets?conditionId=${encodeURIComponent(id)}`);
    const market = Array.isArray(data) ? data[0] : data?.data?.[0];
    if (!market) return res.status(404).json({ error: "Market not found" });

    res.json({ market, _paid: "$0.002 USDC / Base mainnet" });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /orderbook/:tokenId
app.get("/orderbook/:tokenId", async (req, res) => {
  try {
    const { tokenId } = req.params;
    const data = await polyFetch(`${CLOB}/book?token_id=${encodeURIComponent(tokenId)}`);

    const topN = (arr, n = 10) => (arr || []).slice(0, n).map((e) => ({ price: e.price, size: e.size }));

    res.json({
      tokenId,
      market: data.market,
      bids: topN(data.bids),
      asks: topN(data.asks),
      bestBid: data.bids?.[0]?.price || null,
      bestAsk: data.asks?.[0]?.price || null,
      spread: data.bids?.[0] && data.asks?.[0]
        ? (parseFloat(data.asks[0].price) - parseFloat(data.bids[0].price)).toFixed(4)
        : null,
      timestamp: new Date().toISOString(),
      _paid: "$0.005 USDC / Base mainnet",
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /prices?tokens=id1,id2,id3
app.get("/prices", async (req, res) => {
  try {
    const raw = req.query.tokens || "";
    const tokenIds = raw.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 50);
    if (!tokenIds.length) return res.status(400).json({ error: "tokens query param required (comma-separated)" });

    const results = await Promise.allSettled(
      tokenIds.map((id) => polyFetch(`${CLOB}/midpoint?token_id=${encodeURIComponent(id)}`))
    );

    const prices = {};
    tokenIds.forEach((id, i) => {
      const r = results[i];
      prices[id] = r.status === "fulfilled" ? r.value?.mid ?? null : null;
    });

    res.json({ prices, count: tokenIds.length, timestamp: new Date().toISOString(), _paid: "$0.003 USDC / Base mainnet" });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// GET /events?limit=10
app.get("/events", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 50);
    const data = await polyFetch(`${GAMMA}/events?limit=${limit}&active=true&order=volume24hr&ascending=false`);
    const events = (Array.isArray(data) ? data : data.data || []).map((e) => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      startDate: e.startDate,
      endDate: e.endDate,
      volume24hr: e.volume24hr,
      liquidity: e.liquidity,
      markets: (e.markets || []).map((m) => ({
        id: m.conditionId,
        question: m.question,
        outcomePrices: m.outcomePrices,
        volume24hr: m.volume24hr,
      })),
    }));

    res.json({ count: events.length, events, _paid: "$0.001 USDC / Base mainnet" });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

// Free health + docs endpoint
app.get("/", (req, res) => {
  res.json({
    name: "Polymarket Data API",
    version: "1.0.0",
    description: "Real-time Polymarket prediction market data via x402 micropayments",
    payment: "USDC on Base mainnet (eip155:8453)",
    endpoints: [
      { path: "GET /markets", price: "$0.001", params: "?limit=20&tag=crypto&sort=volume24hr&active=true" },
      { path: "GET /market/:conditionId", price: "$0.002", params: "" },
      { path: "GET /orderbook/:tokenId", price: "$0.005", params: "" },
      { path: "GET /prices", price: "$0.003", params: "?tokens=id1,id2,id3" },
      { path: "GET /events", price: "$0.001", params: "?limit=10" },
    ],
    source: "Polymarket Gamma API + CLOB API (public endpoints, no auth required)",
  });
});

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: err.message || "Internal server error" });
});

export default app;
