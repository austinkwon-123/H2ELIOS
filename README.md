# H₂Grid — Global Hydrogen Network Observatory

Single canonical build. **This folder is the only working copy** — edit these files
in place; no version folders, no zips.

## Run
```
cd H2Grid && python -m http.server 8000   # open http://localhost:8000
```
Needs internet: MapLibre GL v5 (CDN), CARTO tiles, Google Fonts, DOE AFDC feed.

## File map
```
index.html            markup + script/style load order
style.css             design tokens + all UI styling (mission-control dark)
hud.css               boot / reticle / scanline accents
build-iea.py          regenerates js/iea-data.js from the IEA Excel databases
build-news.py          regenerates js/news-data.js from hydrogen-relevant RSS feeds
js/
  data.js             curated 138 verified nodes (hand-edited, cited)
  iea-data.js         3,338 IEA "announced" records (generated — don't hand-edit)
  news-data.js        cached hydrogen news headlines (generated — don't hand-edit)
  01-core.js          config, tokens, globe init, state, geometry, utils, load,
                        theme, idle spin
  02-layers.js        network web, hubs, flow arcs, point/line builders, animations
  03-filters.js       status/region/color filters, layer dock, legend
                        (owns TOGGLE_MAP, REGION_GROUPS)
  04-search.js        facility search, header counters, intel ticker
  05-detail.js        click/hover, inspector, project-statistics + relationships
  06-tour.js          10-stop guided fly-through
  07-live.js          DOE AFDC live stations, star-field zoom fade
  iea-layer.js        IEA announced-tier clustering (extends filters)
  hud.js              boot sequence, targeting reticle, decode-text
  08-analytics.js     analytics panel — network bars, live stock tracker, news feed
  09-router.js        hash-based tab router (page show/hide, tab nav, map.resize on return)
  10-calculator.js    hydrogen calculator (Tools tab) — 5 independent live-recompute
                        sub-calcs: unit conversion, efficiency, CAPEX/OPEX, LCOH, current density
  smoke-test.js       headless test (node js/smoke-test.js, needs jsdom)
```

## Editing rules (important)
- Modules are **classic scripts sharing one global scope** — `const map`, helpers,
  and state from `01-core.js` are visible everywhere. Do **not** wrap modules in
  IIFEs/ES-modules or the shared globals break.
- **Load order = dependency order.** `iea-layer.js` needs `TOGGLE_MAP` (filters) and
  patches `applyFilters`; `hud.js` patches `selectFacility`/`showDetail` (detail) —
  both must stay last.
- Refresh IEA data: drop new IEA `.xlsx` files in Downloads, rerun `build-iea.py`.
- Refresh hydrogen news: rerun `python3 build-news.py` (set `ANTHROPIC_API_KEY`
  for LLM-written one-line summaries; without it, falls back to each feed's own
  snippet). Regenerates `js/news-data.js` — review the diff before committing,
  it isn't automatic.
