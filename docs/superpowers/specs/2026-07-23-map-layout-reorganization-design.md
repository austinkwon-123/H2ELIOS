# Map Page Layout Reorganization — Design Spec

Date: 2026-07-23
Status: Approved by user

## Summary

Three positioning fixes to the Map page HUD, discovered via hands-on
browser QA of the previous UI overlay work:

1. The bottom-center filter panel (Status/Region/Color) sits directly over
   the globe, obscuring facility markers. It moves to the left rail, as
   click-triggered flyouts off three new icons below the existing
   layer-dock.
2. The search island (top-right, floating) visually overlaps
   `#regional-ai-panel` and `#detail-card`, which share the same corner.
   Search moves into the top command ribbon instead of floating.
3. `#markets-panel` (the ribbon's small stock/crypto ticker popup) claims
   the bottom-center space the filter panel vacates, and grows, so it has
   room for a future news feed (separate spec).

**Dropped during plan-writing:** an earlier version of this spec had a 4th
item — a deterministic stacking rule for `#detail-card` and
`#regional-ai-panel`, which visually overlap only 50px apart in CSS. While
translating the design into an implementation plan, tracing the actual
show/hide code in `js/05-detail.js` and `js/16-ai-features.js` turned up
that both panels **already force-close each other** whenever either opens
(`js/16-ai-features.js:150-158` closes detail-card when the AI panel
opens; `js/16-ai-features.js:289-297` monkey-patches `showDetail` to close
the AI panel when detail-card opens). The two can never actually be
visible together, so the overlap was only a hypothetical read from CSS
positions in isolation, not a reachable bug. Confirmed with the user and
dropped rather than building dead stacking logic for an unreachable state.

Also fixed in passing: `#search-results` (the facility-match dropdown) is
currently invisible in the real browser — a child of `#search-capsule`,
which has `overflow:hidden` for its width-expand animation, clips the
wider results list to nothing. This has been broken since before this
plan (search box was only renamed, never restructured, in the prior UI
overlay work). Moving search into the ribbon is the natural point to fix
it.

This is a pure layout/positioning + small-coordination-JS pass. No filter
logic, search matching logic, AI-panel content generation, or map data
layer changes.

## Why this approach

- Confirmed via live browser QA (screenshots + `getBoundingClientRect`
  inspection), not just visual impression: `#search-results` genuinely
  renders (real background, `visibility:visible`, `opacity:1`, populated
  `innerHTML`) but is clipped invisible by its `overflow:hidden` ancestor.
  Not a hypothetical — reproduced with a real search query.
- The flyout-category approach for the left rail (chosen from 3 mockup
  options: flyout, always-visible full stack, inline accordion) reuses the
  existing tooltip flyout interaction language already on the layer-dock,
  rather than inventing a new UI pattern. It also keeps the left rail's
  idle height identical to today's layer-dock — no vertical growth when
  filters aren't being touched.
- Moving search into the ribbon (rather than pushing panels down or
  moving search to the top-left) was chosen because it eliminates the
  overlap by removing a stacking context entirely, instead of just
  rearranging which floating layer sits on top of which.

## Design

### 1. Left rail: layer-dock + flyout filter categories

**`index.html`:** three new buttons appended to `#layer-dock`, after the
existing `.dock-sep` + `web` button, in their own group separated by
another `.dock-sep`:

```html
<div class="dock-sep"></div>
<button class="flyout-trigger has-tip tip-right" id="filter-status-trigger" data-flyout="status" aria-label="Filter by status" data-tip="Filter by status" aria-expanded="false" aria-controls="flyout-status">
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M2 12h4M18 12h4M4.2 19.8l2.8-2.8M17 7l2.8-2.8"/></svg>
</button>
<button class="flyout-trigger has-tip tip-right" id="filter-region-trigger" data-flyout="region" aria-label="Filter by region" data-tip="Filter by region" aria-expanded="false" aria-controls="flyout-region">
  <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>
</button>
<button class="flyout-trigger has-tip tip-right" id="filter-color-trigger" data-flyout="color" aria-label="Filter by color" data-tip="Filter by color" aria-expanded="false" aria-controls="flyout-color">
  <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="5"/><path d="M12 13v8M8 21h8"/></svg>
</button>
```

**Deliberately not `.dock-btn`:** `wireDock()` in `js/03-filters.js`
binds a click handler to every `document.querySelectorAll(".dock-btn")`
and toggles `TOGGLE_MAP`-driven layer-visibility `.active` state. Reusing
that class on the flyout triggers would make `wireDock()` also fire on
them (harmlessly no-op on `TOGGLE_MAP[undefined]`, but it would still
toggle `.active` and fight with `wireFlyouts()`'s own `.active`
management for "is this flyout open"). `.flyout-trigger` gets its own CSS
rule with the identical box model/hover treatment as `.dock-btn` (`width:
34px; height: 34px; ...`), so it looks identical while staying outside
`wireDock()`'s selector entirely.

Immediately after `#layer-dock`'s closing `</nav>`, three flyout panels
(siblings of the dock, positioned relative to it via CSS, not nested
inside it — nesting inside `#layer-dock` would make them subject to any
future dock-level overflow/clipping, same class of bug as the
`#search-results` fix in section 2):

```html
<div class="glass flyout-panel" id="flyout-status" data-flyout-panel="status" hidden>
  <div class="filter-label">Status</div>
  <div class="seg-group" id="status-seg">
    <button class="seg-btn active" data-status="all">All</button>
    <button class="seg-btn" data-status="operating">Live</button>
    <button class="seg-btn" data-status="construction">Building</button>
    <button class="seg-btn" data-status="planned">Planned</button>
    <button class="seg-btn" data-status="atrisk">At risk</button>
  </div>
</div>
<div class="glass flyout-panel" id="flyout-region" data-flyout-panel="region" hidden>
  <div class="filter-label">Region</div>
  <div class="seg-group" id="region-seg">
    <button class="seg-btn active" data-region="all">All</button>
    <button class="seg-btn" data-region="americas">Americas</button>
    <button class="seg-btn" data-region="europe">Europe</button>
    <button class="seg-btn" data-region="mena">MEA</button>
    <button class="seg-btn" data-region="apac">Asia-Pac</button>
  </div>
</div>
<div class="glass flyout-panel" id="flyout-color" data-flyout-panel="color" hidden>
  <div class="filter-label">Color</div>
  <div class="seg-group" id="color-seg">
    <button class="legend-dot" data-color="green" aria-label="Green — renewable electrolysis"><span class="swatch sw-green"></span><em>Green</em></button>
    <button class="legend-dot" data-color="blue" aria-label="Blue — SMR + carbon capture"><span class="swatch sw-blue"></span><em>Blue</em></button>
    <button class="legend-dot" data-color="pink" aria-label="Pink — nuclear electrolysis"><span class="swatch sw-pink"></span><em>Pink</em></button>
    <button class="legend-dot" data-color="turquoise" aria-label="Turquoise — methane pyrolysis"><span class="swatch sw-turquoise"></span><em>Turq.</em></button>
    <button class="legend-dot" data-color="gray_blue" aria-label="Gray / mixed — SMR or legacy"><span class="swatch sw-gray"></span><em>Gray</em></button>
    <button class="legend-dot" data-color="brown" aria-label="Brown / black — coal gasification"><span class="swatch sw-brown"></span><em>Brown</em></button>
    <button class="legend-dot" data-color="mfg" aria-label="Electrolyzer gigafactory (manufacturing)"><span class="swatch sw-mfg"></span><em>Mfg</em></button>
  </div>
</div>
```

`#status-seg`/`#region-seg`/`#color-seg` keep their exact ids and button
`data-*` attributes — `03-filters.js`'s `wireSegments()`/`wireLegend()`
(`document.querySelectorAll` based) need no changes. The old `#filter-dock`
element (already merged Status+Region+Color from the prior plan, with its
`#filter-toggle`/`#filter-summary` collapse machinery) is deleted entirely
— that whole collapse/expand feature is superseded by the flyout's
open/closed state, which is the same concept implemented at the icon
level instead of a separate toggle button.

**`style.css`:** flyout panels are `position: fixed; left: 58px` (just
right of the layer-dock's 34px-wide buttons + padding), vertically aligned
to each trigger's `top` via a small JS-set inline style (each trigger's
`getBoundingClientRect().top`), `display:none` via the `hidden` attribute
when closed. Same `backdrop-filter: blur(...)` glass treatment as other
panels. `.flyout-trigger.active` (set only while its flyout is open, by
`wireFlyouts()`) gets the same cyan active-glow treatment `.dock-btn.active`
uses for layer toggles, so an open flyout's trigger icon is visually
distinguishable from the always-on layer icons above it — same look,
different meaning (transient "open" vs. persistent "layer visible").

**`js/03-filters.js`:** new `wireFlyouts()` function:
- Click a `.flyout-trigger` → if its flyout is already open, close it
  (toggle). Otherwise close any other open flyout first, then open this
  one: position it (`top` aligned to the trigger), remove `hidden`, add
  `.active` to the trigger, set `aria-expanded="true"`.
- Click anywhere outside an open flyout panel and outside its trigger →
  close it (reuses the same outside-click pattern `04-search.js` already
  uses for `#search-results`).
- Picking an option inside a flyout does **not** auto-close it (matches
  today's filter-dock behavior, where picking a status doesn't collapse
  the panel) — only clicking the trigger again or clicking outside closes
  it.

### 2. Search moves into the ribbon; fix the results-dropdown clip

**`index.html`:** `#search-capsule` (with `#search-box`... now
`#network-search`, and `#search-results` inside it) moves from being a
top-level `<body>` child to a child of `#ribbon-zone-c`, positioned before
the `Analytics` button:

```html
<div id="ribbon-zone-c">
  <div id="search-capsule">
    <svg class="search-icon" ...></svg>
    <input id="network-search" type="search" placeholder="Search the network… (Cmd/Ctrl+K)" autocomplete="off" />
  </div>
  <button id="analytics-btn" class="tour-button">...</button>
  ...
```

`#search-results` moves **out** of `#search-capsule` to be a sibling,
still inside `#ribbon-zone-c` (or directly under `<body>`, positioned via
JS-synced coordinates) — anywhere outside the `overflow:hidden` capsule.

**`style.css`:**
- `#search-capsule` drops `position:fixed; top/right` — it's now a normal
  flex child of `#ribbon-zone-c`, sized by its own `width`
  animation as before (40px idle → 260px expanded), but no longer needs
  `overflow:hidden` on `#search-capsule` for the results dropdown (only
  the input's cross-fade still needs it) since results is no longer a
  descendant of the capsule.
- `#search-results` becomes `position: fixed` (not `absolute`), so it's
  no longer clipped by any ancestor; its `top`/`right` are set via a small
  JS helper reading `#search-capsule`'s current
  `getBoundingClientRect()` on open (search capsule expand) and on window
  resize, rather than pure CSS — the capsule's position now depends on
  ribbon flex layout instead of a fixed offset, so it isn't a static CSS
  value anymore.

**`js/04-search.js`:** new `positionSearchResults()` helper, called from
the existing `renderSearchResults()` right before it un-hides `results`,
and from a `window.addEventListener("resize", ...)`. No changes to the
actual facility-matching logic (`allFacilities`, `matchesFilters`, the
`.filter()` in `renderSearchResults`).

### 3. Markets panel repositioning

**`style.css`:** `#markets-panel`'s `bottom: 64px` becomes `bottom: 12px`
(the exact value `#filter-dock` used to occupy), and `width: 560px`
becomes `width: min(720px, calc(100vw - 28px))` (mirroring the same
viewport-safe pattern `#filter-dock` used for `max-width`). `#tour-card`
(`bottom: 62px`) is audited for collision with the enlarged Markets panel
when both happen to be open simultaneously — if the plan's implementer
finds they visually collide, `#tour-card`'s offset moves up
(e.g. `bottom: 74px`) as a one-line follow-up within the same task; this
is an implementation-detail check, not a separate design decision.

## Non-goals

- No changes to `applyFilters`, `TOGGLE_MAP`, `REGION_GROUPS`, or any
  filter *logic* — only where the Status/Region/Color buttons live in the
  DOM and how their container opens/closes.
- No changes to search matching/ranking logic — only where the results
  list renders and how its position is computed.
- No changes to `#detail-card`/`#regional-ai-panel` show-hide logic or
  their existing mutual-exclusion behavior — they're already fully
  mutually exclusive (see "Dropped during plan-writing" above), so no
  stacking/repositioning work is needed for them.
- The Markets popup panel's *content* (tickers, chart) and the future
  energy-news feed are out of scope — covered by a separate spec, per the
  user's explicit scope split.
- No localStorage/persistence of which flyout was last open, or of
  panel positions — everything resets to defaults on page load, consistent
  with how every other panel in this app already behaves.
