# UI Overlay Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add custom sidebar tooltips, merge the bottom filter dock + color legend into one glassmorphism panel with a collapse toggle, add a Reset View map control, add a Cmd/Ctrl+K search hotkey (with a `#search-box` → `#network-search` rename), and make the top nav island icon-only so its 9 tabs stop overflowing into horizontal scroll.

**Architecture:** Pure additive/restructuring pass on the existing classic-script, no-build-step app. One shared CSS tooltip component (`.has-tip` + `data-tip`) is reused by both the sidebar dock and the nav island. The filter-dock/legend merge is a markup move — the existing `03-filters.js` click handlers (`wireSegments`, `wireLegend`) are untouched except for one new collapse-toggle wiring function. Reset View is a small custom MapLibre `IControl` class. The search hotkey is a new listener in `04-search.js`.

**Tech Stack:** Vanilla JS (classic scripts, shared global scope), vanilla CSS using the existing `:root` design tokens in `style.css`, MapLibre GL v5. No build step, no new dependencies.

## Global Constraints

- Classic scripts sharing one global lexical scope — do not wrap new code in IIFEs/ES-modules (see README.md "Editing rules").
- Load order = dependency order — new functions get added to existing files (`01-core.js`, `03-filters.js`, `04-search.js`) rather than new script files, so no `<script>` tag additions/reordering are needed in `index.html`.
- No build step, no new external dependencies.
- Test harness: `node js/smoke-test.js` (needs `jsdom` present at `/tmp/node_modules/jsdom` — already confirmed present in this environment). **Baseline note:** on a clean checkout this currently reports `9 FAILURES`, all pre-existing and unrelated to this work (Tools-tab calculator sub-calcs: efficiency/CAPEX-OPEX/LCOH/current-density edge cases). Do not try to fix those. After each task, the failure count must not exceed 9 plus any assertion you intentionally haven't gotten to yet — every assertion *this plan* adds must PASS by the end of its task.
- Do not change `applyFilters`, `TOGGLE_MAP`, `REGION_GROUPS`, or any region/status/color filter *logic* — only container markup and one new collapse-toggle function.
- Do not change search matching/ranking logic in `04-search.js` beyond the id rename and the new hotkey listener.
- Reuse existing design tokens (`--panel`, `--panel-strong`, `--panel-blur`, `--cyan`, `--line`, `--text-hi`, `--label`, `--r-sm`/`--r-md`/`--r-lg`, `--overline`) — do not invent new color values.

---

## Task 1: Shared tooltip CSS component

**Files:**
- Modify: `style.css`

**Interfaces:**
- Consumes: existing tokens `--panel-strong`, `--panel-blur`, `--line`, `--text-hi`, `--r-sm`.
- Produces: CSS classes `.has-tip`, `.tip-right`, `.tip-bottom` that Task 2 (sidebar) and Task 7 (nav island) apply to trigger elements via `data-tip="..."` + `aria-label="..."`.

- [ ] **Step 1: Add the tooltip CSS block**

In `style.css`, find:

```css
.pill.live::before { content: "●"; margin-right: 5px; font-size: 8px; animation: blink 2.4s infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

/* ---------- Layer rail (left): monochrome outline icons ---------- */
```

Replace with:

```css
.pill.live::before { content: "●"; margin-right: 5px; font-size: 8px; animation: blink 2.4s infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

/* ---------- Shared tooltip component: hover/focus a .has-tip element to
   show its data-tip text. Every trigger also carries a real aria-label
   (same string) so screen readers get the name independent of this CSS. ---------- */
.has-tip { position: relative; }
.has-tip::after {
  content: attr(data-tip);
  position: absolute;
  padding: 5px 9px;
  background: var(--panel-strong);
  -webkit-backdrop-filter: blur(var(--panel-blur));
  backdrop-filter: blur(var(--panel-blur));
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  color: var(--text-hi);
  font-size: 10.5px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.15s ease 0.1s, transform 0.15s ease 0.1s;
  z-index: 1200;
}
.has-tip:hover::after, .has-tip:focus-visible::after { opacity: 1; }
.tip-right::after { left: calc(100% + 10px); top: 50%; transform: translateY(-50%) translateX(-2px); }
.tip-right:hover::after, .tip-right:focus-visible::after { transform: translateY(-50%) translateX(0); }
.tip-bottom::after { top: calc(100% + 8px); left: 50%; transform: translateX(-50%) translateY(-2px); }
.tip-bottom:hover::after, .tip-bottom:focus-visible::after { transform: translateX(-50%) translateY(0); }

/* ---------- Layer rail (left): monochrome outline icons ---------- */
```

- [ ] **Step 2: Verify the CSS was added**

Run: `grep -c "has-tip" style.css`
Expected: `9` (one `.has-tip` rule, one `::after` rule, two hover/focus rules, plus `.tip-right`×3 and `.tip-bottom`×3 occurrences — exact count isn't the point, a nonzero count confirms the block landed; if the grep errors or returns `0`, the edit didn't apply).

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: add shared tooltip CSS component"
```

---

## Task 2: Sidebar tooltips (`#layer-dock`)

**Files:**
- Modify: `index.html`
- Modify: `js/smoke-test.js`

**Interfaces:**
- Consumes: `.has-tip`/`.tip-right` from Task 1.
- Produces: nothing consumed by later tasks (self-contained).

- [ ] **Step 1: Add the failing assertions to smoke-test.js first**

Find (near the top of the assertion block, right after the layer-existence loop):

```js
  ["basemap-dark", "upstream", "production", "manufacturing", "storage", "endUse",
   "fuelingStations", "pipelines", "hubs", "hub-labels", "flows-base", "web",
   "selection-ring", "iea-clusters", "iea-cluster-count", "iea-points"]
    .forEach((id) => ok(!!layers[id], `layer exists: ${id}`));
```

Add immediately after it:

```js

  // Sidebar tooltips (Task 2 of the ui-overlay-enhancements plan)
  const dockBtns = doc.querySelectorAll("#layer-dock .dock-btn");
  ok(dockBtns.length === 13, `layer dock has 13 buttons (found ${dockBtns.length})`);
  ok(Array.from(dockBtns).every((b) => b.classList.contains("has-tip") && b.classList.contains("tip-right")), "every dock button has the shared tooltip classes");
  ok(Array.from(dockBtns).every((b) => !!b.getAttribute("aria-label") && b.getAttribute("aria-label") === b.getAttribute("data-tip")), "every dock button's aria-label matches its data-tip");
  ok(Array.from(dockBtns).every((b) => !b.hasAttribute("title")), "no dock button still has a native title attribute (would double up with the custom tooltip)");
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node js/smoke-test.js`
Expected: `FAIL  layer dock has 13 buttons ...` and the following 3 new assertions also FAIL.

- [ ] **Step 3: Update the dock-btn markup**

In `index.html`, find:

```html
<nav class="glass" id="layer-dock" aria-label="Layers">
  <button class="dock-btn active" data-layer="upstream" title="Upstream energy sources"><svg viewBox="0 0 24 24"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg></button>
  <button class="dock-btn active" data-layer="production" title="Production plants"><svg viewBox="0 0 24 24"><path d="M2 20h20M4 20V10l4 3v-3l4 3v-3l4 3V6h4v14"/></svg></button>
  <button class="dock-btn active" data-layer="manufacturing" title="Electrolyzer gigafactories"><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg></button>
  <button class="dock-btn active" data-layer="storage" title="Storage & terminals"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg></button>
  <button class="dock-btn active" data-layer="pipelines" title="Pipelines"><svg viewBox="0 0 24 24"><path d="M2 12h4l3-7 4 14 3-7h6"/></svg></button>
  <button class="dock-btn active" data-layer="endUse" title="End use"><svg viewBox="0 0 24 24"><path d="M1 16V7h13v9M14 10h4l4 4v2h-2M1 16h2m4.5 0H14"/><circle cx="5.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/></svg></button>
  <button class="dock-btn active" data-layer="fuelingStations" title="Fueling stations (live)"><svg viewBox="0 0 24 24"><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M2 21h14M6 8h6M14 10h2a2 2 0 0 1 2 2v5.5a1.5 1.5 0 0 0 3 0V9l-2-2"/></svg></button>
  <button class="dock-btn active" data-layer="hubs" title="DOE hydrogen hubs"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg></button>
  <button class="dock-btn active" data-layer="flows" title="Real supply-chain flows"><svg viewBox="0 0 24 24"><path d="M4 12h14M13 6l6 6-6 6"/></svg></button>
  <button class="dock-btn active" data-layer="iea" title="IEA announced projects (3,300+ records)"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1.6"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 4.9a10 10 0 0 1 0 14.2M5 19.1A10 10 0 0 1 5 4.9"/></svg></button>
  <button class="dock-btn active" data-layer="apiLive" title="Live API (backend, viewport-scoped)"><svg viewBox="0 0 24 24"><path d="M12 2v6M12 16v6M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M2 12h6M16 12h6M4.9 19.1l4.2-4.2M14.9 9.1l4.2-4.2"/></svg></button>
  <button class="dock-btn active" data-layer="commandArcs" title="3D elevated energy arcs (WebGL)"><svg viewBox="0 0 24 24"><path d="M3 18c3-10 15-10 18 0"/><circle cx="3" cy="18" r="1.6"/><circle cx="21" cy="18" r="1.6"/></svg></button>
  <div class="dock-sep"></div>
  <button class="dock-btn active" data-layer="web" title="Network web (illustrative)"><svg viewBox="0 0 24 24"><circle cx="5" cy="5" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="9" cy="19" r="2"/><path d="M7 6l10 .8M6.4 6.8 8.4 17M17.6 8.7 10.7 18"/></svg></button>
</nav>
```

Replace with:

```html
<nav class="glass" id="layer-dock" aria-label="Layers">
  <button class="dock-btn active has-tip tip-right" data-layer="upstream" aria-label="Upstream energy sources" data-tip="Upstream energy sources"><svg viewBox="0 0 24 24"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/></svg></button>
  <button class="dock-btn active has-tip tip-right" data-layer="production" aria-label="Production plants" data-tip="Production plants"><svg viewBox="0 0 24 24"><path d="M2 20h20M4 20V10l4 3v-3l4 3v-3l4 3V6h4v14"/></svg></button>
  <button class="dock-btn active has-tip tip-right" data-layer="manufacturing" aria-label="Electrolyzer gigafactories" data-tip="Electrolyzer gigafactories"><svg viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg></button>
  <button class="dock-btn active has-tip tip-right" data-layer="storage" aria-label="Storage & terminals" data-tip="Storage & terminals"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg></button>
  <button class="dock-btn active has-tip tip-right" data-layer="pipelines" aria-label="Pipelines" data-tip="Pipelines"><svg viewBox="0 0 24 24"><path d="M2 12h4l3-7 4 14 3-7h6"/></svg></button>
  <button class="dock-btn active has-tip tip-right" data-layer="endUse" aria-label="End use" data-tip="End use"><svg viewBox="0 0 24 24"><path d="M1 16V7h13v9M14 10h4l4 4v2h-2M1 16h2m4.5 0H14"/><circle cx="5.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/></svg></button>
  <button class="dock-btn active has-tip tip-right" data-layer="fuelingStations" aria-label="Fueling stations (live)" data-tip="Fueling stations (live)"><svg viewBox="0 0 24 24"><path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M2 21h14M6 8h6M14 10h2a2 2 0 0 1 2 2v5.5a1.5 1.5 0 0 0 3 0V9l-2-2"/></svg></button>
  <button class="dock-btn active has-tip tip-right" data-layer="hubs" aria-label="DOE hydrogen hubs" data-tip="DOE hydrogen hubs"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg></button>
  <button class="dock-btn active has-tip tip-right" data-layer="flows" aria-label="Real supply-chain flows" data-tip="Real supply-chain flows"><svg viewBox="0 0 24 24"><path d="M4 12h14M13 6l6 6-6 6"/></svg></button>
  <button class="dock-btn active has-tip tip-right" data-layer="iea" aria-label="IEA announced projects (3,300+ records)" data-tip="IEA announced projects (3,300+ records)"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="1.6"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 4.9a10 10 0 0 1 0 14.2M5 19.1A10 10 0 0 1 5 4.9"/></svg></button>
  <button class="dock-btn active has-tip tip-right" data-layer="apiLive" aria-label="Live API (backend, viewport-scoped)" data-tip="Live API (backend, viewport-scoped)"><svg viewBox="0 0 24 24"><path d="M12 2v6M12 16v6M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M2 12h6M16 12h6M4.9 19.1l4.2-4.2M14.9 9.1l4.2-4.2"/></svg></button>
  <button class="dock-btn active has-tip tip-right" data-layer="commandArcs" aria-label="3D elevated energy arcs (WebGL)" data-tip="3D elevated energy arcs (WebGL)"><svg viewBox="0 0 24 24"><path d="M3 18c3-10 15-10 18 0"/><circle cx="3" cy="18" r="1.6"/><circle cx="21" cy="18" r="1.6"/></svg></button>
  <div class="dock-sep"></div>
  <button class="dock-btn active has-tip tip-right" data-layer="web" aria-label="Network web (illustrative)" data-tip="Network web (illustrative)"><svg viewBox="0 0 24 24"><circle cx="5" cy="5" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="9" cy="19" r="2"/><path d="M7 6l10 .8M6.4 6.8 8.4 17M17.6 8.7 10.7 18"/></svg></button>
</nav>
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `node js/smoke-test.js`
Expected: the 4 new assertions from Step 1 all `PASS`.

- [ ] **Step 5: Commit**

```bash
git add index.html js/smoke-test.js
git commit -m "feat: custom styled tooltips for the layer-dock sidebar"
```

---

## Task 3: Merge filter dock + color legend into one panel

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Modify: `js/smoke-test.js`

**Interfaces:**
- Consumes: existing `.seg-group`/`.seg-btn`/`.legend-dot` CSS and their click handlers in `03-filters.js` (`wireSegments`, `wireLegend`) — untouched.
- Produces: `#filter-dock > #filter-body` containing 3 `.filter-row` groups (`#status-seg`, `#region-seg`, `#color-seg`), and a `#filter-toggle` button that Task 4 wires up.

- [ ] **Step 1: Add the failing assertions to smoke-test.js first**

Find:

```js
  // Region filter on IEA
  click(doc.querySelector('#region-seg .seg-btn[data-region="europe"]'));
  ok(sources["iea"].data.features.every((f) => f.properties.region === "europe"), "IEA region filter applied");
  click(doc.querySelector('#region-seg .seg-btn[data-region="all"]'));
```

Add immediately after it:

```js

  // Merged filter panel (Task 3 of the ui-overlay-enhancements plan)
  ok(!doc.getElementById("legend"), "old standalone #legend element is gone");
  const filterRows = doc.querySelectorAll("#filter-dock .filter-row");
  ok(filterRows.length === 3, `filter-dock has 3 filter rows (found ${filterRows.length})`);
  ok(!!doc.querySelector("#filter-dock #status-seg"), "status segment lives inside #filter-dock");
  ok(!!doc.querySelector("#filter-dock #region-seg"), "region segment lives inside #filter-dock");
  ok(!!doc.querySelector("#filter-dock #color-seg"), "color segment lives inside #filter-dock");
  ok(doc.querySelectorAll("#color-seg .legend-dot").length === 7, "all 7 legend-dot color buttons moved into #color-seg");
  click(doc.querySelector('#color-seg .legend-dot[data-color="green"]'));
  ok(sources["iea"].data.features.every((f) => f.properties.color === "green"), "color filter (now inside filter-dock) still filters the IEA source");
  click(doc.querySelector('#color-seg .legend-dot[data-color="green"]'));
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node js/smoke-test.js`
Expected: `FAIL  old standalone #legend element is gone` and the following new assertions also FAIL (the merged structure doesn't exist yet).

- [ ] **Step 3: Replace the filter-dock + legend markup**

In `index.html`, find:

```html
<!-- Bottom-center: segmented filters -->
<div class="glass" id="filter-dock">
  <div class="seg-group" id="status-seg">
    <button class="seg-btn active" data-status="all">All</button>
    <button class="seg-btn" data-status="operating">Live</button>
    <button class="seg-btn" data-status="construction">Building</button>
    <button class="seg-btn" data-status="planned">Planned</button>
    <button class="seg-btn" data-status="atrisk">At risk</button>
  </div>
  <div class="seg-sep"></div>
  <div class="seg-group" id="region-seg">
    <button class="seg-btn active" data-region="all">All</button>
    <button class="seg-btn" data-region="americas">Americas</button>
    <button class="seg-btn" data-region="europe">Europe</button>
    <button class="seg-btn" data-region="mena">MEA</button>
    <button class="seg-btn" data-region="apac">Asia-Pac</button>
  </div>
</div>

<!-- Bottom-left: taxonomy legend -->
<div class="glass" id="legend" title="Hydrogen color taxonomy — click to filter">
  <button class="legend-dot" data-color="green" title="Green — renewable electrolysis"><span class="swatch sw-green"></span><em>Green</em></button>
  <button class="legend-dot" data-color="blue" title="Blue — SMR + carbon capture"><span class="swatch sw-blue"></span><em>Blue</em></button>
  <button class="legend-dot" data-color="pink" title="Pink — nuclear electrolysis"><span class="swatch sw-pink"></span><em>Pink</em></button>
  <button class="legend-dot" data-color="turquoise" title="Turquoise — methane pyrolysis"><span class="swatch sw-turquoise"></span><em>Turq.</em></button>
  <button class="legend-dot" data-color="gray_blue" title="Gray / mixed — SMR or legacy"><span class="swatch sw-gray"></span><em>Gray</em></button>
  <button class="legend-dot" data-color="brown" title="Brown / black — coal gasification"><span class="swatch sw-brown"></span><em>Brown</em></button>
  <button class="legend-dot" data-color="mfg" title="Electrolyzer gigafactory (manufacturing)"><span class="swatch sw-mfg"></span><em>Mfg</em></button>
</div>
```

Replace with:

```html
<!-- Bottom-center: merged glassmorphism filter panel (Status / Region / Color) -->
<div class="glass" id="filter-dock">
  <button id="filter-toggle" class="has-tip tip-right" aria-expanded="true" aria-controls="filter-body" aria-label="Collapse filters" data-tip="Collapse filters">
    <svg viewBox="0 0 24 24" width="12" height="12"><path d="M6 9l6 6 6-6"/></svg>
    <span id="filter-summary" hidden></span>
  </button>
  <div id="filter-body">
    <div class="filter-row">
      <span class="filter-label">Status</span>
      <div class="seg-group" id="status-seg">
        <button class="seg-btn active" data-status="all">All</button>
        <button class="seg-btn" data-status="operating">Live</button>
        <button class="seg-btn" data-status="construction">Building</button>
        <button class="seg-btn" data-status="planned">Planned</button>
        <button class="seg-btn" data-status="atrisk">At risk</button>
      </div>
    </div>
    <div class="filter-row">
      <span class="filter-label">Region</span>
      <div class="seg-group" id="region-seg">
        <button class="seg-btn active" data-region="all">All</button>
        <button class="seg-btn" data-region="americas">Americas</button>
        <button class="seg-btn" data-region="europe">Europe</button>
        <button class="seg-btn" data-region="mena">MEA</button>
        <button class="seg-btn" data-region="apac">Asia-Pac</button>
      </div>
    </div>
    <div class="filter-row">
      <span class="filter-label">Color</span>
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
  </div>
</div>
```

(Note: `title` attributes on the `.legend-dot` buttons became `aria-label` — same text — since they're small inline swatches, not full sidebar icons, they don't need the `.has-tip` visual treatment, just the accessible name.)

- [ ] **Step 4: Replace the filter-dock CSS and remove the old #legend rule**

In `style.css`, find:

```css
/* ---------- Filter dock (bottom-center): compact segmented ---------- */
#filter-dock {
  bottom: 12px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 8px;
  padding: 4px 5px;
  border-radius: var(--r-sm);
  max-width: calc(100vw - 28px);
}
.seg-group { display: flex; gap: 4px; background: rgba(120, 160, 200, 0.05); border-radius: var(--r-sm); padding: 2px; }
.seg-sep { width: 1px; height: 18px; background: var(--line); }
```

Replace with:

```css
/* ---------- Filter dock (bottom-center): merged glassmorphism panel,
   Status / Region / Color stacked as labeled rows, collapsible. ---------- */
#filter-dock {
  bottom: 12px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column; align-items: stretch; gap: 6px;
  padding: 8px 12px;
  border-radius: var(--r-lg);
  max-width: calc(100vw - 28px);
  background: rgba(8, 12, 20, 0.55);
  -webkit-backdrop-filter: blur(10px) saturate(140%);
  backdrop-filter: blur(10px) saturate(140%);
}
#filter-toggle {
  align-self: flex-end;
  display: flex; align-items: center; gap: 6px;
  background: transparent; border: none;
  color: var(--text-muted); cursor: pointer;
  padding: 2px;
}
#filter-toggle:hover { color: var(--text-hi); }
#filter-toggle svg { stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; transition: transform 0.2s ease; }
#filter-dock.collapsed #filter-toggle svg { transform: rotate(-90deg); }
#filter-summary {
  font-size: 10px; letter-spacing: 0.04em; color: var(--cyan);
}
#filter-body {
  display: flex; flex-direction: column; gap: 6px;
  overflow: hidden;
  max-height: 200px;
  opacity: 1;
  transition: max-height 0.25s ease, opacity 0.2s ease;
}
#filter-dock.collapsed #filter-body { max-height: 0; opacity: 0; pointer-events: none; }
.filter-row { display: flex; align-items: center; gap: 8px; }
.filter-label {
  font: var(--overline); letter-spacing: var(--overline-tracking);
  text-transform: uppercase; color: var(--label);
  width: 42px; flex-shrink: 0;
}
.seg-group { display: flex; gap: 4px; background: rgba(120, 160, 200, 0.05); border-radius: var(--r-sm); padding: 2px; flex-wrap: wrap; }
```

Then find:

```css
/* ---------- Legend (bottom-left): data encoding key ---------- */
#legend {
  bottom: 12px; left: 14px;
  display: flex; gap: 2px;
  padding: 4px 6px;
  border-radius: var(--r-sm);
}
/* Tactical toggles, keyed to each hydrogen taxonomy color via --toggle-color -
```

Replace with:

```css
/* Tactical toggles, keyed to each hydrogen taxonomy color via --toggle-color -
```

(This removes only the now-unused `#legend { ... }` positional ruleset and its preceding comment header — the `.legend-dot` rules immediately following stay untouched, since that class is reused inside `#color-seg`.)

- [ ] **Step 5: Run the test and confirm it passes**

Run: `node js/smoke-test.js`
Expected: all assertions added in Step 1 `PASS`. Total failure count is still 9 (the pre-existing, unrelated baseline).

- [ ] **Step 6: Commit**

```bash
git add index.html style.css js/smoke-test.js
git commit -m "feat: merge filter dock and color legend into one glassmorphism panel"
```

---

## Task 4: Filter panel collapse/expand toggle

**Files:**
- Modify: `js/03-filters.js`
- Modify: `js/01-core.js`
- Modify: `js/smoke-test.js`

**Interfaces:**
- Consumes: `#filter-toggle`, `#filter-dock`, `#filter-summary`, `.seg-btn`, `.legend-dot` from Task 3.
- Produces: `wireFilterToggle()`, called once from `01-core.js`'s init sequence.

- [ ] **Step 1: Add the failing assertions to smoke-test.js first**

Find (the block added in Task 3, ending with):

```js
  click(doc.querySelector('#color-seg .legend-dot[data-color="green"]'));
  ok(sources["iea"].data.features.every((f) => f.properties.color === "green"), "color filter (now inside filter-dock) still filters the IEA source");
  click(doc.querySelector('#color-seg .legend-dot[data-color="green"]'));
```

Add immediately after it:

```js

  // Filter panel collapse toggle (Task 4 of the ui-overlay-enhancements plan)
  const filterDock = doc.getElementById("filter-dock");
  const filterToggle = doc.getElementById("filter-toggle");
  ok(!filterDock.classList.contains("collapsed"), "filter-dock starts expanded");
  ok(filterToggle.getAttribute("aria-expanded") === "true", "filter-toggle starts aria-expanded=true");
  click(filterToggle);
  ok(filterDock.classList.contains("collapsed"), "clicking filter-toggle collapses the panel");
  ok(filterToggle.getAttribute("aria-expanded") === "false", "filter-toggle updates aria-expanded to false when collapsed");
  click(doc.querySelector('#status-seg .seg-btn[data-status="operating"]'));
  ok(doc.getElementById("filter-summary").textContent.includes("1"), "collapsed summary reflects 1 active non-default filter (status=Live)");
  click(doc.querySelector('#status-seg .seg-btn[data-status="all"]'));
  click(filterToggle);
  ok(!filterDock.classList.contains("collapsed"), "clicking filter-toggle again expands the panel");
  ok(filterToggle.getAttribute("aria-expanded") === "true", "filter-toggle updates aria-expanded back to true when expanded");
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node js/smoke-test.js`
Expected: `FAIL  clicking filter-toggle collapses the panel` and the related new assertions FAIL (no click handler exists yet).

- [ ] **Step 3: Add `wireFilterToggle` and summary-count updates**

In `js/03-filters.js`, find:

```js
function wireSegments() {
  document.querySelectorAll("#status-seg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#status-seg .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      statusFilter = btn.dataset.status;
      applyFilters();
    });
  });
  document.querySelectorAll("#region-seg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#region-seg .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      regionFilter = btn.dataset.region;
      stopSpin();
      applyFilters();
      const views = {
        all: { center: [15, 20], zoom: 1.7 },
        americas: { center: [-95, 30], zoom: 2.8 },
        europe: { center: [8, 51], zoom: 3.9 },
        mena: { center: [38, 15], zoom: 3.0 },
        apac: { center: [122, 15], zoom: 2.8 }
      };
      map.flyTo({ ...(views[regionFilter] || views.all), duration: 1800 });
    });
  });
}

function wireLegend() {
  document.querySelectorAll(".legend-dot").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = btn.dataset.color;
      colorFilter = colorFilter === c ? null : c;
      document.querySelectorAll(".legend-dot").forEach((b) => {
        b.classList.toggle("active", colorFilter === b.dataset.color);
        b.classList.toggle("dimmed", !!colorFilter && colorFilter !== b.dataset.color);
      });
      applyFilters();
    });
  });
}
```

Replace with:

```js
function wireSegments() {
  document.querySelectorAll("#status-seg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#status-seg .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      statusFilter = btn.dataset.status;
      applyFilters();
      updateFilterSummary();
    });
  });
  document.querySelectorAll("#region-seg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#region-seg .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      regionFilter = btn.dataset.region;
      stopSpin();
      applyFilters();
      updateFilterSummary();
      const views = {
        all: { center: [15, 20], zoom: 1.7 },
        americas: { center: [-95, 30], zoom: 2.8 },
        europe: { center: [8, 51], zoom: 3.9 },
        mena: { center: [38, 15], zoom: 3.0 },
        apac: { center: [122, 15], zoom: 2.8 }
      };
      map.flyTo({ ...(views[regionFilter] || views.all), duration: 1800 });
    });
  });
}

function wireLegend() {
  document.querySelectorAll(".legend-dot").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = btn.dataset.color;
      colorFilter = colorFilter === c ? null : c;
      document.querySelectorAll(".legend-dot").forEach((b) => {
        b.classList.toggle("active", colorFilter === b.dataset.color);
        b.classList.toggle("dimmed", !!colorFilter && colorFilter !== b.dataset.color);
      });
      applyFilters();
      updateFilterSummary();
    });
  });
}

function updateFilterSummary() {
  const summary = document.getElementById("filter-summary");
  if (!summary) return;
  let count = 0;
  if (statusFilter !== "all") count++;
  if (regionFilter !== "all") count++;
  if (colorFilter) count++;
  summary.hidden = count === 0;
  summary.textContent = count === 0 ? "" : `${count} filter${count === 1 ? "" : "s"} active`;
}

function wireFilterToggle() {
  const dock = document.getElementById("filter-dock");
  const toggle = document.getElementById("filter-toggle");
  toggle.addEventListener("click", () => {
    const collapsed = dock.classList.toggle("collapsed");
    toggle.setAttribute("aria-expanded", collapsed ? "false" : "true");
  });
}
```

- [ ] **Step 4: Call `wireFilterToggle()` from the init sequence**

In `js/01-core.js`, find:

```js
  wireDock();
  wireSegments();
  wireLegend();
  wireSearch();
```

Replace with:

```js
  wireDock();
  wireSegments();
  wireLegend();
  wireFilterToggle();
  wireSearch();
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `node js/smoke-test.js`
Expected: all assertions added in Step 1 `PASS`.

- [ ] **Step 6: Commit**

```bash
git add js/03-filters.js js/01-core.js js/smoke-test.js
git commit -m "feat: add collapse/expand toggle to the merged filter panel"
```

---

## Task 5: Reset View map control

**Files:**
- Modify: `js/01-core.js`
- Modify: `js/smoke-test.js`

**Interfaces:**
- Consumes: the real `map` object and its initial camera values (`center:[15,20], zoom:1.7, pitch:58, bearing:12`) already set in `01-core.js`'s `maplibregl.Map` constructor.
- Produces: nothing consumed by later tasks (self-contained).

- [ ] **Step 1: Make the StubMap test double support controls with `onAdd`**

The existing `StubMap.addControl()` in `js/smoke-test.js` is a no-op, so a real MapLibre `IControl`'s `onAdd()` never runs in the test environment and its button never appears in the DOM. Fix that, and capture the map instance itself so assertions can inspect `flyTo` calls.

Find:

```js
const layers = {}, sources = {}, handlers = {};
class StubMap {
  constructor(opts) {
    (((opts || {}).style || {}).layers || []).forEach((l) => {
      layers[l.id] = { ...l, visibility: (l.layout && l.layout.visibility) || "visible" };
    });
    setTimeout(() => (handlers["load"] || []).forEach((h) => h()), 0);
  }
  on(ev, a, b) { const key = b ? ev + ":" + a : ev; (handlers[key] = handlers[key] || []).push(b || a); }
  addControl() {}
```

Replace with:

```js
const layers = {}, sources = {}, handlers = {};
let mapInstance = null;
class StubMap {
  constructor(opts) {
    mapInstance = this;
    (((opts || {}).style || {}).layers || []).forEach((l) => {
      layers[l.id] = { ...l, visibility: (l.layout && l.layout.visibility) || "visible" };
    });
    setTimeout(() => (handlers["load"] || []).forEach((h) => h()), 0);
  }
  on(ev, a, b) { const key = b ? ev + ":" + a : ev; (handlers[key] = handlers[key] || []).push(b || a); }
  addControl(ctrl) { if (ctrl && typeof ctrl.onAdd === "function") window.document.body.appendChild(ctrl.onAdd(this)); }
```

- [ ] **Step 2: Add the failing assertions**

Find:

```js
  ["basemap-dark", "upstream", "production", "manufacturing", "storage", "endUse",
   "fuelingStations", "pipelines", "hubs", "hub-labels", "flows-base", "web",
   "selection-ring", "iea-clusters", "iea-cluster-count", "iea-points"]
    .forEach((id) => ok(!!layers[id], `layer exists: ${id}`));
```

Add immediately after it:

```js

  // Reset View map control (Task 5 of the ui-overlay-enhancements plan)
  const resetBtn = doc.querySelector('[aria-label="Reset view"]');
  ok(!!resetBtn, "Reset view button rendered");
  ok(!!resetBtn && resetBtn.closest(".maplibregl-ctrl-group") !== null, "Reset view button uses maplibregl-ctrl-group chrome");
  if (resetBtn) click(resetBtn);
  ok(!!mapInstance.lastFly, "Reset view button calls map.flyTo");
  ok(!!mapInstance.lastFly && mapInstance.lastFly.center[0] === 15 && mapInstance.lastFly.center[1] === 20, "Reset view flies back to the initial center [15,20]");
  ok(!!mapInstance.lastFly && mapInstance.lastFly.zoom === 1.7 && mapInstance.lastFly.pitch === 58 && mapInstance.lastFly.bearing === 12, "Reset view restores the initial zoom/pitch/bearing");
```

- [ ] **Step 3: Run the test and confirm it fails**

Run: `node js/smoke-test.js`
Expected: `FAIL  Reset view button rendered` and the following new assertions also FAIL.

- [ ] **Step 4: Add the ResetViewControl class and register it**

In `js/01-core.js`, find:

```js
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: false }), "top-left");
```

Replace with:

```js
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: false }), "top-left");

class ResetViewControl {
  onAdd(mapRef) {
    this._map = mapRef;
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";
    const btn = document.createElement("button");
    btn.className = "has-tip tip-right";
    btn.type = "button";
    btn.setAttribute("aria-label", "Reset view");
    btn.setAttribute("data-tip", "Reset view");
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" style="stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>';
    btn.onclick = () => mapRef.flyTo({ center: [15, 20], zoom: 1.7, pitch: 58, bearing: 12, duration: 1200 });
    this._container.appendChild(btn);
    return this._container;
  }
  onRemove() { this._container.remove(); this._map = undefined; }
}
map.addControl(new ResetViewControl(), "top-left");
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `node js/smoke-test.js`
Expected: all assertions added in Step 2 `PASS`.

- [ ] **Step 6: Commit**

```bash
git add js/01-core.js js/smoke-test.js
git commit -m "feat: add Reset View control under the zoom buttons"
```

---

## Task 6: Search hotkey (Cmd/Ctrl+K) + `#search-box` → `#network-search` rename

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Modify: `js/04-search.js`
- Modify: `js/smoke-test.js`

**Interfaces:**
- Consumes: `#search-capsule` (unchanged) for the existing hover/focus-within CSS expand behavior.
- Produces: nothing consumed by later tasks (self-contained).

- [ ] **Step 1: Rename in smoke-test.js first (so existing search assertions keep passing against the new id) and add the hotkey assertions**

Find:

```js
  const box = doc.getElementById("search-box");
  const results = doc.getElementById("search-results");
  box.focus();
  box.value = "kobe";
```

Replace with:

```js
  const box = doc.getElementById("network-search");
  const results = doc.getElementById("search-results");
  box.focus();
  box.value = "kobe";
```

Find:

```js
  // AI project detail injection (clear region filter first so Stegra is searchable)
  click(doc.querySelector('#region-seg .seg-btn[data-region="all"]'));
  const searchBox = doc.getElementById("search-box");
  searchBox.focus();
```

Replace with:

```js
  // AI project detail injection (clear region filter first so Stegra is searchable)
  click(doc.querySelector('#region-seg .seg-btn[data-region="all"]'));
  const searchBox = doc.getElementById("network-search");
  searchBox.focus();
```

Then find:

```js
  ok(doc.querySelector(".detail-ai-text") !== null, "detail panel injects AI Project Engagement Analysis");
```

Add immediately after it:

```js

  // Search hotkey (Task 6 of the ui-overlay-enhancements plan)
  ok(!doc.getElementById("search-box"), "old #search-box id is gone");
  ok(!!doc.getElementById("network-search"), "#network-search exists");
  doc.activeElement.blur();
  ok(doc.activeElement !== doc.getElementById("network-search"), "search input not focused before the hotkey fires");
  doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true, cancelable: true }));
  ok(doc.activeElement === doc.getElementById("network-search"), "Ctrl+K focuses #network-search");
  doc.activeElement.blur();
  doc.dispatchEvent(new window.KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true, cancelable: true }));
  ok(doc.activeElement === doc.getElementById("network-search"), "Cmd+K (metaKey) focuses #network-search");
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node js/smoke-test.js`
Expected: `FAIL  old #search-box id is gone` (still present) and the hotkey assertions also FAIL (no listener yet, and `network-search` doesn't exist yet so the earlier renamed lookups throw/fail too).

- [ ] **Step 3: Rename the id in index.html**

Find:

```html
  <input id="search-box" type="search" placeholder="Search the network…" autocomplete="off" />
```

Replace with:

```html
  <input id="network-search" type="search" placeholder="Search the network… (Cmd/Ctrl+K)" autocomplete="off" />
```

- [ ] **Step 4: Rename the id in style.css**

Find:

```css
#search-box {
  flex: 1; min-width: 0;
  background: transparent; border: none; outline: none;
  color: var(--text-hi); font-size: 12.5px; font-family: inherit;
  opacity: 0;
  transition: opacity 0.18s ease;
}
#search-capsule:hover #search-box,
#search-capsule:focus-within #search-box {
  opacity: 1; transition-delay: 0.12s;
}
#search-box::placeholder { color: var(--text-faint); }
```

Replace with:

```css
#network-search {
  flex: 1; min-width: 0;
  background: transparent; border: none; outline: none;
  color: var(--text-hi); font-size: 12.5px; font-family: inherit;
  opacity: 0;
  transition: opacity 0.18s ease;
}
#search-capsule:hover #network-search,
#search-capsule:focus-within #network-search {
  opacity: 1; transition-delay: 0.12s;
}
#network-search::placeholder { color: var(--text-faint); }
```

- [ ] **Step 5: Rename the id references and add the hotkey listener in 04-search.js**

Find:

```js
function wireSearch() {
  const box = document.getElementById("search-box");
  const results = document.getElementById("search-results");
  box.addEventListener("input", renderSearchResults);
  box.addEventListener("focus", renderSearchResults);
  document.addEventListener("click", (e) => {
    if (!document.getElementById("search-capsule").contains(e.target)) results.hidden = true;
  });
}

function renderSearchResults() {
  const box = document.getElementById("search-box");
```

Replace with:

```js
function wireSearch() {
  const box = document.getElementById("network-search");
  const results = document.getElementById("search-results");
  box.addEventListener("input", renderSearchResults);
  box.addEventListener("focus", renderSearchResults);
  document.addEventListener("click", (e) => {
    if (!document.getElementById("search-capsule").contains(e.target)) results.hidden = true;
  });
}

function wireSearchHotkey() {
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const box = document.getElementById("network-search");
      box.focus();
      box.select();
    }
  });
}

function renderSearchResults() {
  const box = document.getElementById("network-search");
```

- [ ] **Step 6: Call `wireSearchHotkey()` from the init sequence**

In `js/01-core.js`, find:

```js
  wireFilterToggle();
  wireSearch();
```

Replace with:

```js
  wireFilterToggle();
  wireSearch();
  wireSearchHotkey();
```

- [ ] **Step 7: Run the test and confirm it passes**

Run: `node js/smoke-test.js`
Expected: all assertions touched/added in Step 1 `PASS`.

- [ ] **Step 8: Commit**

```bash
git add index.html style.css js/04-search.js js/01-core.js js/smoke-test.js
git commit -m "feat: Cmd/Ctrl+K search hotkey, rename #search-box to #network-search"
```

---

## Task 7: Icon-only top nav island

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Modify: `js/smoke-test.js`

**Interfaces:**
- Consumes: `.has-tip`/`.tip-bottom` from Task 1.
- Produces: nothing consumed by later tasks (self-contained).

- [ ] **Step 1: Add the failing assertions to smoke-test.js first**

Find:

```js
  ok(doc.querySelectorAll("#tab-nav .tab-btn").length === 9, "tab nav has 9 buttons");
  ok(!!doc.querySelector('.tab-btn[data-route="map"]') && doc.querySelector('.tab-btn[data-route="map"]').classList.contains("active"), "Map tab active by default");
```

Add immediately after it:

```js

  // Icon-only nav island (Task 7 of the ui-overlay-enhancements plan)
  const tabBtns = doc.querySelectorAll("#tab-nav .tab-btn");
  ok(Array.from(tabBtns).every((b) => b.classList.contains("has-tip") && b.classList.contains("tip-bottom")), "every tab button has the shared tooltip classes");
  ok(Array.from(tabBtns).every((b) => !!b.getAttribute("aria-label") && b.getAttribute("aria-label") === b.getAttribute("data-tip")), "every tab button's aria-label matches its data-tip");
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node js/smoke-test.js`
Expected: the 2 new assertions `FAIL` (no `.has-tip`/`aria-label`/`data-tip` on tab buttons yet).

- [ ] **Step 3: Add tooltip attributes to the nav markup**

In `index.html`, find:

```html
<nav id="tab-nav" aria-label="Sections">
  <button class="tab-btn active" data-route="map"><svg viewBox="0 0 24 24"><path d="M9 3 3 5.5v15L9 18l6 2.5 6-2.5v-15L15 5.5 9 3z"/><path d="M9 3v15M15 5.5v15"/></svg><span>Map</span></button>
  <button class="tab-btn" data-route="market"><svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg><span>Market &amp; Economics</span></button>
  <button class="tab-btn" data-route="technology"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg><span>Technology</span></button>
  <button class="tab-btn" data-route="demand-transport"><svg viewBox="0 0 24 24"><path d="M1 16V7h13v9M14 10h4l4 4v2h-2M1 16h2m4.5 0H14"/><circle cx="5.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/></svg><span>Demand &amp; Transport</span></button>
  <button class="tab-btn" data-route="macro-flow"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg><span>Macro Flow</span></button>
  <button class="tab-btn" data-route="policy"><svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5M9 12h6M9 16h6"/></svg><span>Policy</span></button>
  <button class="tab-btn" data-route="timeline"><svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg><span>Temporal Sandbox</span></button>
  <button class="tab-btn" data-route="companies"><svg viewBox="0 0 24 24"><rect x="3" y="8" width="7" height="13"/><rect x="14" y="3" width="7" height="18"/><path d="M6 12h1M6 16h1M17 7h1M17 11h1M17 15h1"/></svg><span>Companies &amp; Partners</span></button>
  <button class="tab-btn" data-route="tools"><svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-3-3z"/></svg><span>Tools</span></button>
</nav>
```

Replace with:

```html
<nav id="tab-nav" aria-label="Sections">
  <button class="tab-btn active has-tip tip-bottom" data-route="map" aria-label="Map" data-tip="Map"><svg viewBox="0 0 24 24"><path d="M9 3 3 5.5v15L9 18l6 2.5 6-2.5v-15L15 5.5 9 3z"/><path d="M9 3v15M15 5.5v15"/></svg><span>Map</span></button>
  <button class="tab-btn has-tip tip-bottom" data-route="market" aria-label="Market & Economics" data-tip="Market & Economics"><svg viewBox="0 0 24 24"><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg><span>Market &amp; Economics</span></button>
  <button class="tab-btn has-tip tip-bottom" data-route="technology" aria-label="Technology" data-tip="Technology"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg><span>Technology</span></button>
  <button class="tab-btn has-tip tip-bottom" data-route="demand-transport" aria-label="Demand & Transport" data-tip="Demand & Transport"><svg viewBox="0 0 24 24"><path d="M1 16V7h13v9M14 10h4l4 4v2h-2M1 16h2m4.5 0H14"/><circle cx="5.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/></svg><span>Demand &amp; Transport</span></button>
  <button class="tab-btn has-tip tip-bottom" data-route="macro-flow" aria-label="Macro Flow" data-tip="Macro Flow"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg><span>Macro Flow</span></button>
  <button class="tab-btn has-tip tip-bottom" data-route="policy" aria-label="Policy" data-tip="Policy"><svg viewBox="0 0 24 24"><path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5M9 12h6M9 16h6"/></svg><span>Policy</span></button>
  <button class="tab-btn has-tip tip-bottom" data-route="timeline" aria-label="Temporal Sandbox" data-tip="Temporal Sandbox"><svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg><span>Temporal Sandbox</span></button>
  <button class="tab-btn has-tip tip-bottom" data-route="companies" aria-label="Companies & Partners" data-tip="Companies & Partners"><svg viewBox="0 0 24 24"><rect x="3" y="8" width="7" height="13"/><rect x="14" y="3" width="7" height="18"/><path d="M6 12h1M6 16h1M17 7h1M17 11h1M17 15h1"/></svg><span>Companies &amp; Partners</span></button>
  <button class="tab-btn has-tip tip-bottom" data-route="tools" aria-label="Tools" data-tip="Tools"><svg viewBox="0 0 24 24"><path d="M14.7 6.3a4 4 0 0 1-5.4 5.4L4 17l3 3 5.3-5.3a4 4 0 0 1 5.4-5.4l-3-3z"/></svg><span>Tools</span></button>
</nav>
```

- [ ] **Step 4: Drop the hover-expand + scroll CSS, keep the active-tab label expand**

In `style.css`, find:

```css
#tab-nav {
  position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
  z-index: 1001;
  display: flex; align-items: center; gap: 1px;
  padding: 6px;
  background: rgba(4, 6, 10, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55);
  max-width: min(60vw, 720px);
  overflow-x: auto;
  transition: box-shadow 0.25s ease;
}
```

Replace with:

```css
#tab-nav {
  position: fixed; top: 8px; left: 50%; transform: translateX(-50%);
  z-index: 1001;
  display: flex; align-items: center; gap: 1px;
  padding: 6px;
  background: rgba(4, 6, 10, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.55);
  transition: box-shadow 0.25s ease;
}
```

Then find:

```css
#tab-nav:hover .tab-btn span,
#tab-nav:focus-within .tab-btn span,
.tab-btn.active span {
  max-width: 160px; margin-left: 6px;
  opacity: 1;
}
```

Replace with:

```css
.tab-btn.active span {
  max-width: 160px; margin-left: 6px;
  opacity: 1;
}
```

(Icon-only is now the permanent idle *and* hover state for every non-active tab — only `.tab-btn.active span` still expands, so the current page's name stays visible as a small label chip next to its icon. Tooltip-on-hover, from Step 3's `.has-tip tip-bottom`, replaces the old hover-expand as the way to learn an inactive tab's name.)

- [ ] **Step 5: Run the test and confirm it passes**

Run: `node js/smoke-test.js`
Expected: all assertions added in Step 1 `PASS`.

- [ ] **Step 6: Commit**

```bash
git add index.html style.css js/smoke-test.js
git commit -m "feat: icon-only top nav island with tooltips, remove horizontal scroll"
```

---

## Task 8: Manual visual QA

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Start the app**

Run: `node server.js` (requires the `h2grid-db` Docker container from `docker-compose.yml` to already be up — `docker compose up -d`). Open `http://localhost:8000/`.

- [ ] **Step 2: Check each feature visually**

- Hover each icon in the left layer-dock: a dark glass tooltip should fly out to the right, matching its old `title` text, with a short fade+slide-in.
- Bottom-center: one panel with Status / Region / Color rows, visibly blurred/translucent background over the globe. Click the chevron: panel collapses to a thin bar with an "N filters active" pill when a non-default filter is active, and back.
- Top-left: zoom +/- buttons, with a new Home-style "Reset view" button directly under them in the same style. Pan/zoom/rotate the globe, click it, confirm the camera flies back to the original framing.
- Press Cmd+K (or Ctrl+K on Windows) anywhere on the page: the search island expands and the input is focused with a blinking cursor, ready to type.
- Top nav island: only icons show at rest (including the previously-active-only ones); hovering any icon shows a small tooltip below it with its page name; the currently active tab still shows its icon + label together. Confirm there's no horizontal scrollbar/cut-off in the island at normal desktop widths.

- [ ] **Step 3: Report back**

If anything looks visually off (wrong tooltip placement, panel not blurring, control misaligned), note it — that's a follow-up polish task, not a reason to revert the plan's committed work.

## Non-goals (carried over from the spec)

- No localStorage persistence for the filter-panel collapse state.
- No changes to `applyFilters`, `TOGGLE_MAP`, region/status/color filtering logic itself.
- No changes to search matching/ranking logic beyond the id rename and the new listener.
- No "More ▾" overflow menu for the nav island — icon-only was the chosen fix.
