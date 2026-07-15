# Markets Comparison Chart — Design Spec

Date: 2026-07-14
Status: Approved by user (amended same day, see below)

## Summary

Add a TradingView comparison chart to the Markets section, showing the
Global X Hydrogen ETF against two broad-market benchmarks, overlaid on one
normalized % scale. Sits above the existing per-ticker price rows (built in
the original analytics-panel feature) — additive, not a replacement.

## Symbols (verified directly against TradingView's widget builder)

- `NASDAQ:HYDR` — Global X Hydrogen ETF (the real ticker is HYDR, not HDRO)
- `NASDAQ:IXIC` — NASDAQ Composite index
- `SP:SPX` — S&P 500 index

## Implementation

- New `<div id="analytics-markets-chart">` inside the Markets panel, above
  the existing quote rows.
- TradingView's **Advanced Chart** embed script
  (`https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js`),
  `symbol: "NASDAQ:HYDR"` with `compareSymbols: [{symbol: "NASDAQ:IXIC",
  position: "SameScale"}, {symbol: "SP:SPX", position: "SameScale"}]` — this
  is what actually overlays all three as one normalized line chart.
  (**Amendment:** the original plan below specified the "Symbol Overview"
  widget instead; verification against the live widget builder showed that
  widget only tabs between symbols one at a time rather than overlaying
  them, so it was swapped for Advanced Chart before shipping.)
- `theme: "dark"`, `backgroundColor: "#0F0F0F"` matching the panel's own
  background; top toolbar, side toolbar, and volume hidden for a compact
  embedded look; `style: "2"` (line chart, not candles — clearer with 3
  overlaid series).
- Loaded once, lazily on first Markets-panel open (not at page load) —
  matches the "no background fetch until opened" convention the rest of
  the panel already follows, and avoids loading a third-party script the
  user may never see.

## Amendment 2026-07-14: Markets is its own panel, not part of Analytics

After shipping, the user found the original placement — stacked inside the
same 320px-wide left-docked Analytics panel as Network/Intel — too narrow
for the chart to be useful. Markets was split out into its own panel:

- New `#markets-btn` toggle button in `#action-capsule`, alongside
  `#analytics-btn` and `#tour-btn`.
- New `#markets-panel`, bottom-docked and centered (`bottom: 64px; left:
  50%; transform: translateX(-50%)`), **560px wide** (vs. the 320px
  Analytics panel) — landscape charts read better wide than tall.
  `max-height: 420px`, sits just above `#filter-dock`.
- `#analytics-panel` keeps only Network Composition and Intel; the
  `MARKETS` `.stats-head`, `#analytics-markets-chart`, and
  `#analytics-markets` blocks all moved into `#markets-panel`.
- Independent open/close lifecycle: opening `#markets-panel` lazily injects
  the TradingView chart (first open only) and starts the 60s quote-polling
  loop; closing stops polling. Opening/closing `#analytics-panel` no longer
  has any effect on Markets, and vice versa.

## Out of scope

- No new API key required (TradingView's public embed needs none).
- Not replacing the existing Finnhub-backed ticker rows.
- No attempt to theme the widget beyond color/font passthrough — it's a
  third-party iframe, full pixel-level control isn't available.
