# Markets Comparison Chart — Design Spec

Date: 2026-07-14
Status: Approved by user

## Summary

Add a TradingView "Symbol Overview" comparison chart to the analytics
panel's Markets section, showing the Global X Hydrogen ETF against two
broad-market benchmarks. Sits above the existing per-ticker price rows
(built in the original analytics-panel feature) — additive, not a
replacement.

## Symbols (verified directly against TradingView's widget builder)

- `NASDAQ:HYDR` — Global X Hydrogen ETF (the real ticker is HYDR, not HDRO)
- `NASDAQ:IXIC` — NASDAQ Composite index
- `SP:SPX` — S&P 500 index

## Implementation

- New `<div id="analytics-markets-chart">` inside `#analytics-markets`,
  above the existing quote rows.
- TradingView's embed script
  (`https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js`)
  injected once, with a JSON config matching the verified symbols above.
- `colorTheme: "dark"`, `isTransparent: true` so it sits on the panel's own
  background rather than a solid block.
- `upColor`/`downColor` set to the project's existing `--green-ok`
  (`#4cc38a`) / `--red` (`#e5635c`) hex values (widget config can't read
  CSS custom properties, so the hex values are duplicated into the JSON —
  same tradeoff as `COLORS` in `js/01-core.js` already duplicating the
  `--h-*` taxonomy hexes for use in Mapbox expressions).
- `fontFamily` set to match the project's `--font` stack.
- Roughly 200px fixed height, `width: "100%"` (fills the 320px panel).
- Loaded once on panel init (not re-created on every toggle open/close —
  TradingView's iframe-based widget persists in the DOM once inserted).

## Out of scope

- No new API key required (TradingView's public embed needs none).
- Not replacing the existing Finnhub-backed ticker rows.
- No attempt to theme the widget beyond color/font passthrough — it's a
  third-party iframe, full pixel-level control isn't available.
