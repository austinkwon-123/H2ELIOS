# Tab/Router Shell (Phase 0) — Design Spec

Date: 2026-07-15
Status: Approved by user

## Summary

H2Grid is growing from a single map page into a multi-tab application (11
planned feature areas across 7 tabs — Market & Economics, Technology,
Demand & Transport, Policy, Companies & Partners, Tools, plus the existing
Map). This spec covers only the foundational shell: hash-based routing,
page structure, and a tab nav bar. It intentionally does **not** build any
of the 11 feature areas themselves — those are separate, later specs, each
needing their own data-source decisions (several explicitly don't have a
data source yet, per prior discussion).

## Why this approach

Two constraints drove the design, both confirmed with the user:

1. **No build step.** The project's existing convention (see README.md
   "Editing rules") is classic scripts sharing one global lexical scope,
   no bundler. Rather than introducing Vite/a framework (a full stack
   change), routing is a small hand-written hash router — consistent with
   how every other cross-cutting concern in this codebase already works
   (`applyFilters` patching, `TOGGLE_MAP`, etc.).
2. **Everything currently on screen is Map-tab content.** The HUD panels
   built in earlier work (Analytics, Markets, detail-card, tour, legend,
   filters) are Map-specific — they read `D`/`IEA_DATA`/`map` state that
   only exists on the Map tab. They must not be reachable or half-rendered
   from other tabs.

## Design

### Router (`js/09-router.js`, new file)

```js
const ROUTES = {
  map: { page: "page-map", init: null },              // already initialized eagerly by existing modules
  market: { page: "page-market", init: "initMarketPage" },
  technology: { page: "page-technology", init: "initTechnologyPage" },
  "demand-transport": { page: "page-demand-transport", init: "initDemandTransportPage" },
  policy: { page: "page-policy", init: "initPolicyPage" },
  companies: { page: "page-companies", init: "initCompaniesPage" },
  tools: { page: "page-tools", init: "initToolsPage" }
};
```

- `navigateTo(route)`: validates `route` against `ROUTES` (falls back to
  `map` for an unknown hash — e.g. a stale/typo'd bookmark), hides all
  `.page` sections, shows the target, updates `.tab-btn.active`, calls the
  route's `init` function **once** (tracked via a `loaded` flag per route
  entry) via `window[entry.init]()`, and if the target is `map`, calls
  `map.resize()` on the next animation frame (MapLibre can't measure its
  canvas while the page was `display:none`).
- `window.addEventListener("hashchange", ...)` calls `navigateTo` with the
  new hash — covers back/forward navigation and direct deep-links (typing
  `/#technology` and loading the page goes straight there).
- On `DOMContentLoaded`, reads `location.hash.slice(1) || "map"` and calls
  `navigateTo` once for the initial route.
- Tab nav buttons (`.tab-btn[data-route]`) set `location.hash = route`
  on click — the `hashchange` listener does the actual work, so clicking
  and typing a URL go through the same code path.

### Page structure (`index.html`)

- Every element currently a direct child of `<body>` except `<script>`
  tags — `<main id="map">`, `#brand-capsule`, `#search-capsule`,
  `#action-capsule`, `#layer-dock`, `#filter-dock`, `#legend`,
  `#detail-card`, `#analytics-panel`, `#markets-panel`, `#tour-card`,
  `#insight-ticker`, `#attribution` — moves inside a new
  `<section id="page-map" class="page">` wrapper. Since all of these are
  already `position: fixed`, wrapping them does not change their layout
  (fixed positioning is relative to the viewport, not the parent, as long
  as no ancestor sets `transform`/`filter`/`perspective` — none do here).
- Six new placeholder sections, each `class="page" hidden`:
  `page-market`, `page-technology`, `page-demand-transport`, `page-policy`,
  `page-companies`, `page-tools`. Each contains one `.page-placeholder`
  div with a heading and "Coming soon" text — real content is later specs.
- New `<nav class="glass" id="tab-nav">` between the existing header row
  and the map, with 7 `.tab-btn` buttons (Map active by default).

### CSS

- `.page { }` / `.page[hidden] { display: none; }` — `[hidden]` already
  does this by default in HTML5, this rule is just explicit/defensive
  since `.glass` and other rules don't override `display`.
- `#tab-nav`: glass capsule row, full-width-ish, centered, positioned
  below the existing top capsule row (`brand-capsule`/`search-capsule`/
  `action-capsule` sit at `top: 14px`; `#tab-nav` sits at `top: 60px`,
  matching the same vertical rhythm `#analytics-panel`/`#markets-panel`
  already use for "below the header row").
- `.tab-btn`: same visual language as `.dock-btn`/`.tour-button` (existing
  button styles), `.tab-btn.active` gets the cyan accent treatment.
- `.page-placeholder`: centered, muted text, matches existing empty-state
  styling conventions (`.news-empty`, `.markets-fallback`).

### What does NOT change in this spec

- No changes to any existing feature's logic (Network bars, Markets,
  Intel, filters, tour, search) — only their DOM position (wrapped inside
  `#page-map`).
- No new data, no AI integration, no new external dependencies.
- The 6 placeholder pages render only a "coming soon" message — their real
  content, data sources, and (where relevant) AI-safety architecture are
  separate specs per feature area, written when each is picked up.

## Testing

- Extend `js/smoke-test.js`: assert all 7 `.page` sections exist, `#map`
  is the only one visible on load (matching `location.hash === ""`),
  clicking each `.tab-btn` shows only that page and hides the rest,
  clicking back to `#map` re-shows the existing map/HUD elements
  unchanged, and a direct `dom.window.location.hash = "#technology"`
  followed by firing `hashchange` lands on the technology page (covers
  deep-linking without needing a real browser navigation).
- Manual verification via the dev server: click through all 7 tabs,
  confirm the globe still renders (and isn't blank/broken) when
  navigating away from and back to Map, confirm browser back/forward
  buttons work, confirm loading a URL with `#technology` directly lands
  on that tab.
