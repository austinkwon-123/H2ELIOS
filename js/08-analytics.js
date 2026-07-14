/* ==========================================================================
   H2Grid · Analytics panel
   Network composition bars, live stock tracker, hydrogen industry news.
   Additive HUD module — patches applyFilters, wires the new toggle button.
   Browser classic scripts share one global lexical scope, so map, helpers &
   state from core/filters are visible here. Load order matters — see
   index.html (must load after 03-filters.js and hud.js).
   ======================================================================= */

const TAXONOMY_ORDER = ["green", "blue", "pink", "turquoise", "gray_blue", "brown", "mfg"];
const TAXONOMY_LABELS = {
  green: "Green", blue: "Blue", pink: "Pink", turquoise: "Turquoise",
  gray_blue: "Gray", brown: "Brown", mfg: "Mfg"
};

function computeColorCounts() {
  const feats = [
    ...D.upstream.features, ...D.production.features, ...D.manufacturing.features,
    ...D.storagePoints.features, ...D.pipelines.features, ...D.endUse.features
  ];
  if (window.IEA_DATA && typeof layerVisible === "function" && layerVisible("iea")) {
    feats.push(...window.IEA_DATA.features);
  }
  const counts = {};
  TAXONOMY_ORDER.forEach((k) => { counts[k] = 0; });
  feats.forEach((f) => {
    const p = f.properties;
    if (statusFilter !== "all" && p.statusClass !== statusFilter) return;
    if (regionFilter !== "all" && !(REGION_GROUPS[regionFilter] || []).includes(p.region)) return;
    if (counts.hasOwnProperty(p.color)) counts[p.color]++;
  });
  return counts;
}

function renderNetworkBars() {
  const el = document.getElementById("analytics-network");
  if (!el) return;
  const counts = computeColorCounts();
  const max = Math.max(1, ...TAXONOMY_ORDER.map((k) => counts[k]));
  el.innerHTML = TAXONOMY_ORDER.map((k) => {
    const n = counts[k];
    const pct = Math.round((n / max) * 100);
    return `<div class="bar-row">
      <span class="bar-label">${TAXONOMY_LABELS[k]}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${COLORS[k]}"></span></span>
      <span class="bar-count">${n}</span>
    </div>`;
  }).join("");
}

// Free tier: https://finnhub.io/register — unlike NREL's DEMO_KEY, Finnhub
// has no public demo key, so this is a personal key. Visible in the page
// source like any client-side key on a static site with no backend.
const FINNHUB_KEY = "d9asl71r01qp4bhsd5dgd9asl71r01qp4bhsd5e0";
// Finnhub's free tier only resolves US-listed tickers — ITM Power (LSE:
// ITM.L) and Nel ASA (OSE: NEL.OL) 403 on it, so this uses US-tradeable
// stand-ins: Fusion Fuel Green (pure-play green hydrogen) and Air Liquide's
// US ADR (industrial-gas major, alongside Linde/Air Products).
const STOCK_TICKERS = [
  { symbol: "PLUG", name: "Plug Power" },
  { symbol: "BE", name: "Bloom Energy" },
  { symbol: "BLDP", name: "Ballard Power" },
  { symbol: "HTOO", name: "Fusion Fuel Green" },
  { symbol: "AIQUY", name: "Air Liquide" },
  { symbol: "FCEL", name: "FuelCell Energy" },
  { symbol: "APD", name: "Air Products" },
  { symbol: "LIN", name: "Linde" },
  { symbol: "CMI", name: "Cummins" },
  { symbol: "GTLS", name: "Chart Industries" }
];
let marketsInterval = null;

async function fetchQuote(symbol) {
  const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_KEY}`);
  if (!res.ok) throw new Error(`Finnhub HTTP ${res.status}`);
  return res.json(); // { c: current price, dp: percent change, ... }
}

async function renderMarkets() {
  const el = document.getElementById("analytics-markets");
  if (!el) return;
  if (!FINNHUB_KEY) {
    el.innerHTML = `<div class="markets-fallback">Configure a free Finnhub API key in js/08-analytics.js for live quotes. <a href="https://finnhub.io/register" target="_blank" rel="noopener">Get one free</a></div>`;
    return;
  }
  try {
    const settled = await Promise.allSettled(STOCK_TICKERS.map((t) => fetchQuote(t.symbol).then((q) => ({ ...t, q }))));
    const quotes = settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
    if (!quotes.length) throw new Error("All ticker quotes failed");
    el.innerHTML = quotes.map(({ symbol, name, q }) => {
      const up = (q.dp || 0) >= 0;
      return `<div class="stock-row">
        <span class="stock-symbol">${escapeHtml(symbol)}</span>
        <span class="stock-name">${escapeHtml(name)}</span>
        <span class="stock-price">${q.c != null ? q.c.toFixed(2) : "—"}</span>
        <span class="stock-change ${up ? "up" : "down"}">${q.dp != null ? (up ? "+" : "") + q.dp.toFixed(2) + "%" : "—"}</span>
      </div>`;
    }).join("");
  } catch (err) {
    console.warn("Markets fetch failed:", err);
    el.innerHTML = `<div class="markets-fallback">Live quotes unavailable — check your connection or API key.</div>`;
  }
}

function startMarketsPolling() {
  renderMarkets();
  if (marketsInterval) clearInterval(marketsInterval);
  marketsInterval = setInterval(renderMarkets, 60000);
}

function stopMarketsPolling() {
  if (marketsInterval) clearInterval(marketsInterval);
  marketsInterval = null;
}

function renderNews() {
  const el = document.getElementById("analytics-news");
  if (!el) return;
  const items = window.HYDROGEN_NEWS || [];
  if (!items.length) {
    el.innerHTML = `<div class="news-empty">No cached headlines — run build-news.py to refresh.</div>`;
    return;
  }
  el.innerHTML = items.map((n) => {
    const safeUrl = /^https?:\/\//i.test(n.url || "") ? n.url : null;
    const tag = safeUrl ? "a" : "div";
    const linkAttrs = safeUrl ? ` href="${escapeAttr(safeUrl)}" target="_blank" rel="noopener"` : "";
    return `<${tag} class="news-card"${linkAttrs}>
      <span class="news-source">${escapeHtml(n.source)}</span>
      <span class="news-headline">${escapeHtml(n.summary || n.headline)}</span>
      <span class="news-date">${escapeHtml(n.date || "")}</span>
    </${tag}>`;
  }).join("");
}

// One-time TradingView embed: HYDR (Global X Hydrogen ETF) overlaid with
// the NASDAQ Composite and S&P 500 on one normalized % scale (compareSymbols
// with position:"SameScale" — verified directly against TradingView's
// widget builder, since "Symbol Overview" only tabs between symbols one at
// a time and doesn't actually overlay them). Injected once on init, not
// re-rendered on toggle/poll — it's a persistent third-party widget, unlike
// the innerHTML-replaced ticker rows below it.
function initMarketsChart() {
  const el = document.getElementById("analytics-markets-chart");
  if (!el) return;
  el.innerHTML = `<div class="tradingview-widget-container" style="height:100%;width:100%"><div class="tradingview-widget-container__widget" style="height:calc(100% - 32px);width:100%"></div></div>`;
  const script = document.createElement("script");
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
  script.async = true;
  script.text = JSON.stringify({
    allow_symbol_change: true,
    calendar: false,
    details: false,
    hide_side_toolbar: true,
    hide_top_toolbar: true,
    hide_legend: false,
    hide_volume: true,
    hotlist: false,
    interval: "D",
    locale: "en",
    save_image: false,
    style: "2", // line chart — clearer than candles with 3 overlaid series
    symbol: "NASDAQ:HYDR",
    theme: "dark",
    timezone: "Etc/UTC",
    backgroundColor: "#0F0F0F",
    gridColor: "rgba(242, 242, 242, 0.06)",
    watchlist: [],
    withdateranges: false,
    compareSymbols: [
      { symbol: "NASDAQ:IXIC", position: "SameScale" },
      { symbol: "SP:SPX", position: "SameScale" }
    ],
    studies: [],
    autosize: true
  });
  el.querySelector(".tradingview-widget-container").appendChild(script);
}

function wireAnalyticsToggle() {
  const btn = document.getElementById("analytics-btn");
  const panel = document.getElementById("analytics-panel");
  if (!btn || !panel) return;
  btn.addEventListener("click", () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    btn.classList.toggle("active", opening);
    if (opening) {
      renderNetworkBars();
      renderNews();
      startMarketsPolling();
    } else {
      stopMarketsPolling();
    }
  });
}

function wireIeaDockRerender() {
  const ieaToggle = document.querySelector('.dock-btn[data-layer="iea"]');
  // wireDock()'s own listener (attached later, inside the async
  // map.on("load", ...) handler in 01-core.js) is what actually toggles
  // .active — deferring with setTimeout guarantees this runs after that
  // class change regardless of which listener attached first.
  if (ieaToggle) ieaToggle.addEventListener("click", () => setTimeout(renderNetworkBars, 0));
}

function initAnalyticsPanel() {
  wireAnalyticsToggle();
  wireIeaDockRerender();
  initMarketsChart();
  renderNetworkBars();
  renderNews();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAnalyticsPanel);
else initAnalyticsPanel();

// Keep the Network bars live-linked to the status/region filters.
const _applyFilters = applyFilters;
applyFilters = function () {
  _applyFilters();
  renderNetworkBars();
};
