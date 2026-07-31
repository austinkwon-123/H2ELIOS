const express = require('express');

const router = express.Router();

// Server-side Finnhub proxy.
//
// The key lives in FINNHUB_KEY (.env, gitignored) and never reaches the
// browser. Previously the key sat in js/08-analytics.js, which on a static
// site means every visitor can read it out of the page source — that key had
// already been committed to git history once and has to be treated as burned.
//
// Finnhub's free tier is 60 requests/minute and the Markets panel polls 10
// tickers, so responses are cached briefly and shared across all clients:
// one upstream call per ticker per CACHE_MS no matter how many people have
// the panel open.
const CACHE_MS = 30000;
const cache = new Map(); // symbol -> { at, data }

const SYMBOL_RE = /^[A-Z.\-]{1,12}$/; // Finnhub tickers only; keeps arbitrary paths out of the upstream URL

async function quoteFor(symbol) {
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(process.env.FINNHUB_KEY)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = new Error(`Finnhub responded ${res.status} for ${symbol}`);
    err.status = res.status === 429 ? 429 : 502;
    throw err;
  }
  const data = await res.json();
  cache.set(symbol, { at: Date.now(), data });
  return data;
}

// GET /api/quotes?symbols=PLUG,BE,BLDP
// -> { configured: true, quotes: { PLUG: {c, dp, ...}, ... }, failed: [...] }
router.get('/', async (req, res) => {
  // Reported rather than thrown, so the panel can render an honest "not
  // configured" state instead of an error toast on a perfectly healthy server.
  if (!process.env.FINNHUB_KEY) {
    return res.json({ configured: false, quotes: {}, failed: [] });
  }

  const symbols = String(req.query.symbols || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => SYMBOL_RE.test(s))
    .slice(0, 25);

  if (!symbols.length) {
    return res.status(400).json({ error: 'symbols query parameter is required' });
  }

  const settled = await Promise.allSettled(symbols.map((s) => quoteFor(s).then((d) => [s, d])));
  const quotes = {};
  const failed = [];
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') quotes[r.value[0]] = r.value[1];
    else failed.push(symbols[i]);
  });

  res.json({ configured: true, quotes, failed });
});

module.exports = router;
