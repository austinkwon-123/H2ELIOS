# Map Page Layout Reorganization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the Status/Region/Color filter panel from covering the globe, stop the search island from overlapping the AI Regional Overview panel, and give the Markets popup panel more room — three positioning fixes to the Map page HUD, plus a fix for a pre-existing bug where the search results dropdown is invisible.

**Architecture:** Pure layout/positioning + small-coordination-JS pass on the existing classic-script, no-build-step app. The three Status/Region/Color filter groups move from one bottom-center panel into three click-triggered flyouts off new icons on the left layer-dock rail (reusing the existing tooltip-flyout visual language, but click-triggered and persistent instead of hover-only). The search island stops floating and becomes a normal child of the top ribbon; its results dropdown is detached from the capsule's `overflow:hidden` box so it's no longer clipped. The Markets panel claims the bottom-center space the filter panel vacates and grows.

**Tech Stack:** Vanilla JS (classic scripts, shared global scope), vanilla CSS using the existing `:root` design tokens in `style.css`. No build step, no new dependencies.

## Global Constraints

- Classic scripts sharing one global lexical scope — do not wrap new code in IIFEs/ES-modules (see README.md "Editing rules").
- No build step, no new external dependencies.
- Test harness: `node js/smoke-test.js` (needs `jsdom` present at `/tmp/node_modules/jsdom`). **Baseline:** currently reports `9 FAILURES`, all pre-existing and unrelated to this work (Tools-tab calculator sub-calc edge cases). Do not try to fix those. Every assertion *this plan* adds must PASS; the total failure count must not exceed 9.
- jsdom has no real layout engine — `getBoundingClientRect()` always returns all-zero rects in the test harness. Do not write assertions that depend on real pixel values; test structure (DOM location, attributes, classes) and behavior (does a function run without throwing, does the right element get shown/hidden), not geometry. Geometry is verified by the manual browser QA task at the end of this plan.
- Do not change `applyFilters`, `TOGGLE_MAP`, `REGION_GROUPS`, or any region/status/color filter *logic* — only where the buttons live in the DOM and how their container opens/closes.
- Do not change search matching/ranking logic (`allFacilities`, `matchesFilters`, the `.filter()` in `renderSearchResults`) — only where the results list renders and how its position is computed.
- `.flyout-trigger` buttons must NOT use the `.dock-btn` class — `wireDock()` in `js/03-filters.js` binds every `.dock-btn` to `TOGGLE_MAP`-driven layer-visibility toggling, which would fight with the flyouts' own open/closed `.active` state if reused.
- `#detail-card`/`#regional-ai-panel` already fully mutually-exclude each other in the existing code (verified: `js/16-ai-features.js:150-158` and `:289-297`) — do not add any stacking/repositioning logic for them, that scenario is unreachable and out of scope for this plan.

---

## Task 1: Left rail flyout filters — markup + CSS scaffold

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Modify: `js/smoke-test.js`

**Interfaces:**
- Consumes: `.has-tip`/`.tip-right` tooltip classes (already in `style.css` from prior work).
- Produces: 3 `.flyout-trigger` buttons (`#filter-status-trigger`, `#filter-region-trigger`, `#filter-color-trigger`) and 3 `.flyout-panel` containers (`#flyout-status`, `#flyout-region`, `#flyout-color`, each starting `hidden`) that Task 2's `wireFlyouts()` opens/closes. `#status-seg`/`#region-seg`/`#color-seg` keep their existing ids/button `data-*` attributes unchanged.

- [ ] **Step 1: Add the failing assertions to smoke-test.js first**

Find (the existing region-filter block, right before the old merged-filter-panel assertions):

```js
  // Region filter on IEA
  click(doc.querySelector('#region-seg .seg-btn[data-region="europe"]'));
  ok(sources["iea"].data.features.every((f) => f.properties.region === "europe"), "IEA region filter applied");
  click(doc.querySelector('#region-seg .seg-btn[data-region="all"]'));

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

Replace with (this removes the now-obsolete filter-dock/toggle assertions from the prior plan and replaces them with the new flyout structure assertions — Task 2 adds the *behavior* assertions on top of this):

```js
  // Region filter on IEA
  click(doc.querySelector('#region-seg .seg-btn[data-region="europe"]'));
  ok(sources["iea"].data.features.every((f) => f.properties.region === "europe"), "IEA region filter applied");
  click(doc.querySelector('#region-seg .seg-btn[data-region="all"]'));

  // Left-rail flyout filters: markup scaffold (Task 1 of the map-layout-reorganization plan)
  ok(!doc.getElementById("legend"), "old standalone #legend element is gone");
  ok(!doc.getElementById("filter-dock"), "old merged #filter-dock element is gone");
  ["status", "region", "color"].forEach((k) => {
    const trigger = doc.getElementById(`filter-${k}-trigger`);
    const panel = doc.getElementById(`flyout-${k}`);
    ok(!!trigger, `flyout trigger exists: filter-${k}-trigger`);
    ok(!trigger.classList.contains("dock-btn"), `filter-${k}-trigger does not carry the .dock-btn class`);
    ok(trigger.classList.contains("flyout-trigger"), `filter-${k}-trigger carries .flyout-trigger`);
    ok(trigger.getAttribute("aria-controls") === `flyout-${k}`, `filter-${k}-trigger aria-controls points at flyout-${k}`);
    ok(!!panel, `flyout panel exists: flyout-${k}`);
    ok(panel.hidden, `flyout-${k} starts hidden`);
  });
  ok(!!doc.querySelector("#flyout-status #status-seg"), "status segment lives inside #flyout-status");
  ok(!!doc.querySelector("#flyout-region #region-seg"), "region segment lives inside #flyout-region");
  ok(!!doc.querySelector("#flyout-color #color-seg"), "color segment lives inside #flyout-color");
  ok(doc.querySelectorAll("#color-seg .legend-dot").length === 7, "all 7 legend-dot color buttons moved into #color-seg");
  click(doc.querySelector('#color-seg .legend-dot[data-color="green"]'));
  ok(sources["iea"].data.features.every((f) => f.properties.color === "green"), "color filter (now inside a flyout) still filters the IEA source");
  click(doc.querySelector('#color-seg .legend-dot[data-color="green"]'));
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node js/smoke-test.js`
Expected: `FAIL  old merged #filter-dock element is gone` (still present) and the following new assertions also FAIL (the flyout markup doesn't exist yet).

- [ ] **Step 3: Replace the filter-dock markup with flyout triggers + panels**

In `index.html`, find:

```html
  <div class="dock-sep"></div>
  <button class="dock-btn active has-tip tip-right" data-layer="web" aria-label="Network web (illustrative)" data-tip="Network web (illustrative)"><svg viewBox="0 0 24 24"><circle cx="5" cy="5" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="9" cy="19" r="2"/><path d="M7 6l10 .8M6.4 6.8 8.4 17M17.6 8.7 10.7 18"/></svg></button>
</nav>

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

Replace with:

```html
  <div class="dock-sep"></div>
  <button class="dock-btn active has-tip tip-right" data-layer="web" aria-label="Network web (illustrative)" data-tip="Network web (illustrative)"><svg viewBox="0 0 24 24"><circle cx="5" cy="5" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="9" cy="19" r="2"/><path d="M7 6l10 .8M6.4 6.8 8.4 17M17.6 8.7 10.7 18"/></svg></button>
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
</nav>

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

(Note: `#layer-dock`'s `</nav>` tag moved earlier — the three flyout panels are now siblings of `#layer-dock`, not children, so they aren't subject to any dock-level overflow/clipping.)

- [ ] **Step 4: Replace the filter-dock CSS with flyout-trigger/flyout-panel CSS**

In `style.css`, find:

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

Replace with:

```css
/* ---------- Left rail: flyout filter triggers (Status/Region/Color), same
   box model as .dock-btn but deliberately a different class so wireDock()'s
   .dock-btn selector (TOGGLE_MAP-driven layer visibility) never binds to
   them — see js/03-filters.js wireFlyouts(). ---------- */
.flyout-trigger {
  width: 34px; height: 34px;
  display: flex; align-items: center; justify-content: center;
  background: transparent;
  border: none; border-radius: var(--r-sm);
  cursor: pointer;
  color: var(--text-faint);
  position: relative;
  transition: color 0.15s ease, background 0.15s ease;
}
.flyout-trigger svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.flyout-trigger:hover { color: var(--text); background: rgba(120, 160, 200, 0.06); }
.flyout-trigger.active { color: var(--cyan); filter: drop-shadow(0 0 6px rgba(63, 214, 232, 0.8)); }
.flyout-trigger.active::before {
  content: "";
  position: absolute; left: -3px; top: 9px; bottom: 9px;
  width: 2px; border-radius: 1px;
  background: var(--cyan);
}
.flyout-trigger:focus-visible { outline: 1px solid var(--cyan); }

/* Flyout panels: positioned just right of the layer-dock (34px button +
   padding). `top` is set inline by wireFlyouts() per open, aligned to
   the triggering icon's own position, so each flyout opens level with
   its trigger rather than at one fixed height. */
.flyout-panel {
  left: 58px;
  width: 200px;
  padding: 10px 12px;
  border-radius: var(--r-md);
}
.flyout-panel .filter-label {
  display: block;
  font: var(--overline); letter-spacing: var(--overline-tracking);
  text-transform: uppercase; color: var(--label);
  margin-bottom: 8px;
}
.seg-group { display: flex; gap: 4px; background: rgba(120, 160, 200, 0.05); border-radius: var(--r-sm); padding: 2px; flex-wrap: wrap; }
```

- [ ] **Step 5: Remove the dead mobile `#filter-dock`/`#legend` media-query rules**

In `style.css`, find:

```css
  #tab-nav { max-width: min(60vw, 380px); top: 6px; }
  #search-capsule { top: 60px; right: 10px; }
  #filter-dock { bottom: 66px; flex-wrap: wrap; border-radius: var(--r-lg); justify-content: center; }
  #legend { bottom: 14px; left: 50%; transform: translateX(-50%); }
  #layer-dock { left: 7px; }
```

Replace with:

```css
  #tab-nav { max-width: min(60vw, 380px); top: 6px; }
  #layer-dock { left: 7px; }
```

(`#filter-dock` and `#legend` no longer exist as elements — both rules were already dead weight even before this task, per the prior plan's final review notes. `#search-capsule`'s mobile override is removed here too since Task 3 makes it a normal ribbon child instead of a `position:fixed` island — its mobile positioning will come from the ribbon's own responsive rules, not a standalone override.)

- [ ] **Step 6: Run the test and confirm it passes**

Run: `node js/smoke-test.js`
Expected: all assertions added in Step 1 `PASS`. Total failure count is still 9 (the pre-existing, unrelated baseline).

- [ ] **Step 7: Commit**

```bash
git add index.html style.css js/smoke-test.js
git commit -m "feat: move Status/Region/Color filters from bottom-center panel to left-rail flyouts (markup + CSS scaffold)"
```

---

## Task 2: Left rail flyout filters — open/close behavior

**Files:**
- Modify: `js/03-filters.js`
- Modify: `js/01-core.js`
- Modify: `js/smoke-test.js`

**Interfaces:**
- Consumes: `#filter-status-trigger`/`#filter-region-trigger`/`#filter-color-trigger`, `#flyout-status`/`#flyout-region`/`#flyout-color` from Task 1.
- Produces: `wireFlyouts()`, called once from `01-core.js`'s init sequence, replacing the removed `wireFilterToggle()` call.

- [ ] **Step 1: Add the failing assertions to smoke-test.js first**

Find (the block added in Task 1, ending with):

```js
  click(doc.querySelector('#color-seg .legend-dot[data-color="green"]'));
  ok(sources["iea"].data.features.every((f) => f.properties.color === "green"), "color filter (now inside a flyout) still filters the IEA source");
  click(doc.querySelector('#color-seg .legend-dot[data-color="green"]'));
```

Add immediately after it:

```js

  // Left-rail flyout filters: open/close behavior (Task 2 of the map-layout-reorganization plan)
  const statusTrigger = doc.getElementById("filter-status-trigger");
  const regionTrigger = doc.getElementById("filter-region-trigger");
  const statusFlyout = doc.getElementById("flyout-status");
  const regionFlyout = doc.getElementById("flyout-region");
  click(statusTrigger);
  ok(!statusFlyout.hidden, "clicking the status trigger opens its flyout");
  ok(statusTrigger.classList.contains("active"), "status trigger gets .active while open");
  ok(statusTrigger.getAttribute("aria-expanded") === "true", "status trigger aria-expanded becomes true while open");
  click(regionTrigger);
  ok(!regionFlyout.hidden, "clicking the region trigger opens its flyout");
  ok(statusFlyout.hidden, "opening the region flyout closes the status flyout (only one open at a time)");
  ok(!statusTrigger.classList.contains("active"), "status trigger loses .active once its flyout closes");
  click(regionTrigger);
  ok(regionFlyout.hidden, "clicking the region trigger again closes its own flyout");
  ok(regionTrigger.getAttribute("aria-expanded") === "false", "region trigger aria-expanded becomes false once closed");
  click(statusTrigger);
  ok(!statusFlyout.hidden, "status flyout re-opens");
  click(doc.body);
  ok(statusFlyout.hidden, "clicking outside an open flyout closes it");
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node js/smoke-test.js`
Expected: `FAIL  clicking the status trigger opens its flyout` and the related new assertions FAIL (no click handler exists yet).

- [ ] **Step 3: Remove the old toggle/summary functions and add `wireFlyouts()`**

In `js/03-filters.js`, find:

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

Replace with:

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

function closeFlyout(trigger, panel) {
  panel.hidden = true;
  panel.style.top = "";
  trigger.classList.remove("active");
  trigger.setAttribute("aria-expanded", "false");
}

function wireFlyouts() {
  const entries = ["status", "region", "color"].map((k) => ({
    key: k,
    trigger: document.getElementById(`filter-${k}-trigger`),
    panel: document.getElementById(`flyout-${k}`)
  }));

  entries.forEach(({ trigger, panel }) => {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = !panel.hidden;
      entries.forEach((entry) => closeFlyout(entry.trigger, entry.panel));
      if (!isOpen) {
        panel.style.top = `${trigger.getBoundingClientRect().top}px`;
        panel.hidden = false;
        trigger.classList.add("active");
        trigger.setAttribute("aria-expanded", "true");
      }
    });
  });

  document.addEventListener("click", (e) => {
    entries.forEach(({ trigger, panel }) => {
      if (!panel.hidden && !panel.contains(e.target) && !trigger.contains(e.target)) {
        closeFlyout(trigger, panel);
      }
    });
  });
}
```

- [ ] **Step 4: Swap the init call from `wireFilterToggle()` to `wireFlyouts()`**

In `js/01-core.js`, find:

```js
  wireDock();
  wireSegments();
  wireLegend();
  wireFilterToggle();
  wireSearch();
```

Replace with:

```js
  wireDock();
  wireSegments();
  wireLegend();
  wireFlyouts();
  wireSearch();
```

- [ ] **Step 5: Run the test and confirm it passes**

Run: `node js/smoke-test.js`
Expected: all assertions added in Step 1 `PASS`.

- [ ] **Step 6: Commit**

```bash
git add js/03-filters.js js/01-core.js js/smoke-test.js
git commit -m "feat: wire click-to-open/close behavior for the left-rail filter flyouts"
```

---

## Task 3: Search moves into the ribbon; fix the results-dropdown clip

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Modify: `js/04-search.js`
- Modify: `js/smoke-test.js`

**Interfaces:**
- Consumes: `#ribbon-zone-c` (existing ribbon container).
- Produces: `positionSearchResults()` in `js/04-search.js`, called from `renderSearchResults()` and a `window` resize listener.

- [ ] **Step 1: Add the failing assertions to smoke-test.js first**

Find:

```js
  // Search hotkey (Task 6 of the ui-overlay-enhancements plan)
  ok(!doc.getElementById("search-box"), "old #search-box id is gone");
```

Add immediately before it:

```js

  // Search moves into the ribbon; results-dropdown clip fix (Task 3 of the map-layout-reorganization plan)
  ok(doc.getElementById("ribbon-zone-c").contains(doc.getElementById("search-capsule")), "#search-capsule now lives inside #ribbon-zone-c");
  ok(!doc.getElementById("search-capsule").contains(doc.getElementById("search-results")), "#search-results is no longer a descendant of #search-capsule (was clipped by its overflow:hidden)");
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node js/smoke-test.js`
Expected: `FAIL  #search-capsule now lives inside #ribbon-zone-c` and the following new assertion also FAILS.

- [ ] **Step 3: Move the search markup into the ribbon**

In `index.html`, find:

```html
  <div id="ribbon-zone-c">
    <button id="analytics-btn" class="tour-button"><svg viewBox="0 0 24 24"><rect x="3" y="10" width="4" height="10"/><rect x="10" y="5" width="4" height="15"/><rect x="17" y="13" width="4" height="7"/></svg>Analytics</button>
    <button id="markets-btn" class="tour-button"><svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>Markets</button>
    <button id="tour-btn" class="tour-button"><svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8V4z"/></svg>Tour</button>
    <span id="api-status" class="pill">Loading…</span>
  </div>
</header>

<nav id="tab-nav" aria-label="Sections">
```

Replace with:

```html
  <div id="ribbon-zone-c">
    <div id="search-capsule">
      <svg class="search-icon" viewBox="0 0 24 24" width="15" height="15"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"/></svg>
      <input id="network-search" type="search" placeholder="Search the network… (Cmd/Ctrl+K)" autocomplete="off" />
    </div>
    <button id="analytics-btn" class="tour-button"><svg viewBox="0 0 24 24"><rect x="3" y="10" width="4" height="10"/><rect x="10" y="5" width="4" height="15"/><rect x="17" y="13" width="4" height="7"/></svg>Analytics</button>
    <button id="markets-btn" class="tour-button"><svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8M15 7h6v6"/></svg>Markets</button>
    <button id="tour-btn" class="tour-button"><svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8V4z"/></svg>Tour</button>
    <span id="api-status" class="pill">Loading…</span>
  </div>
</header>

<div class="glass" id="search-results" hidden></div>

<nav id="tab-nav" aria-label="Sections">
```

Then find (removing the old top-level `#search-capsule` block, since it now lives inside the ribbon above):

```html
<div id="search-capsule">
  <svg class="search-icon" viewBox="0 0 24 24" width="15" height="15"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"/></svg>
  <input id="network-search" type="search" placeholder="Search the network… (Cmd/Ctrl+K)" autocomplete="off" />
  <div class="glass" id="search-results" hidden></div>
</div>

<section id="page-map" class="page">
```

Replace with:

```html
<section id="page-map" class="page">
```

- [ ] **Step 4: Update the search-capsule/search-results CSS**

In `style.css`, find:

```css
/* ==========================================================================
   Dynamic Island: search. Same idle-collapsed/hover-expand language as the
   nav island, floating independently just under Zone C rather than nested
   inside the ribbon. Collapses to a bare icon (40px circle); hover or focus
   (typing) pops it open into the real input.
   ========================================================================= */
#search-capsule {
  position: fixed; top: 70px; right: 20px; z-index: 999;
  display: flex; align-items: center; gap: 8px;
  width: 40px; height: 40px;
  padding: 0 13px;
  background: rgba(4, 6, 10, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  cursor: pointer;
  transition: width 0.34s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease;
}
```

Replace with:

```css
/* ==========================================================================
   Search: no longer a floating "Dynamic Island" (that caused it to overlap
   #regional-ai-panel/#detail-card, which both live top-right below the
   ribbon) - now a normal flex child of #ribbon-zone-c. Still collapses to
   a bare icon (40px circle); hover or focus (typing) pops it open into the
   real input. #search-results (the match dropdown) is a SIBLING, not a
   descendant, of this capsule - it used to be nested inside, which meant
   this element's own overflow:hidden (needed for the width-expand
   animation) silently clipped the wider dropdown to nothing. See
   positionSearchResults() in js/04-search.js.
   ========================================================================= */
#search-capsule {
  display: flex; align-items: center; gap: 8px;
  width: 40px; height: 40px;
  padding: 0 13px;
  background: rgba(4, 6, 10, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  cursor: pointer;
  transition: width 0.34s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease;
}
```

Then find:

```css
#search-results {
  position: absolute; top: calc(100% + 10px); right: 0;
  width: 320px;
  max-height: 46vh; overflow-y: auto;
  border-radius: var(--r-md);
  padding: 4px;
  background: var(--panel-strong);
  scrollbar-width: thin; scrollbar-color: var(--text-faint) transparent;
}
```

Replace with:

```css
#search-results {
  position: fixed;
  width: 320px;
  max-height: 46vh; overflow-y: auto;
  border-radius: var(--r-md);
  padding: 4px;
  background: var(--panel-strong);
  scrollbar-width: thin; scrollbar-color: var(--text-faint) transparent;
}
```

(`top`/`right` are no longer static — `positionSearchResults()` sets them
inline from `#search-capsule`'s live `getBoundingClientRect()`, since the
capsule's position now depends on the ribbon's flex layout instead of a
fixed offset.)

- [ ] **Step 5: Add `positionSearchResults()` and call it from `renderSearchResults()`**

In `js/04-search.js`, find:

```js
function renderSearchResults() {
  const box = document.getElementById("network-search");
  const results = document.getElementById("search-results");
  if (document.activeElement !== box && !box.value) { results.hidden = true; return; }
```

Replace with:

```js
function positionSearchResults() {
  const capsule = document.getElementById("search-capsule");
  const results = document.getElementById("search-results");
  const rect = capsule.getBoundingClientRect();
  results.style.top = `${rect.bottom + 10}px`;
  results.style.right = `${window.innerWidth - rect.right}px`;
}

function renderSearchResults() {
  const box = document.getElementById("network-search");
  const results = document.getElementById("search-results");
  if (document.activeElement !== box && !box.value) { results.hidden = true; return; }
  positionSearchResults();
```

- [ ] **Step 6: Reposition on window resize**

In `js/04-search.js`, find:

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
  window.addEventListener("resize", () => {
    if (!results.hidden) positionSearchResults();
  });
}
```

- [ ] **Step 7: Run the test and confirm it passes**

Run: `node js/smoke-test.js`
Expected: all assertions added in Step 1 `PASS`, and every pre-existing search assertion (typing "kobe", clicking a `.fac-item`, the Ctrl/Cmd+K hotkey assertions) still `PASS` — the search markup moved, but `#network-search`/`#search-results` ids and `renderSearchResults()`'s matching logic are unchanged.

- [ ] **Step 8: Commit**

```bash
git add index.html style.css js/04-search.js js/smoke-test.js
git commit -m "feat: move search into the top ribbon, fix search-results dropdown clipping"
```

---

## Task 4: Markets panel repositioning

**Files:**
- Modify: `style.css`

**Interfaces:** none (pure CSS value changes, no new selectors consumed or produced).

- [ ] **Step 1: Resize and reposition `#markets-panel`**

In `style.css`, find:

```css
/* ---------- Markets panel (bottom-center, wider — needs room for the chart) ---------- */
#markets-panel {
  bottom: 64px; left: 50%; transform: translateX(-50%);
  width: 560px; max-width: calc(100vw - 32px);
  max-height: 420px;
```

Replace with:

```css
/* ---------- Markets panel (bottom-center, wider — needs room for the chart) ---------- */
#markets-panel {
  bottom: 12px; left: 50%; transform: translateX(-50%);
  width: min(720px, calc(100vw - 28px));
  max-height: 420px;
```

- [ ] **Step 2: Verify the CSS is syntactically valid**

Run: `grep -A6 "^#markets-panel {" style.css`
Expected: the block shown above, with matching braces and no syntax errors (visually confirm — this is a CSS-only change with no automated syntax checker in this project's toolchain).

- [ ] **Step 3: Start the app and check for a Markets/Tour-card visual collision**

Run: `node server.js` (requires `docker compose up -d` for the `h2grid-db` container first) and open `http://localhost:8000/`. Click the ribbon's "Markets" button to open `#markets-panel`, then click the "Tour" button to start the guided tour (which opens `#tour-card`, also bottom-center at `bottom: 62px`) without closing Markets first.

- If the two panels visually overlap/collide: in `style.css`, find `#tour-card { left: 50%; bottom: 62px; transform: translateX(-50%);` and change `bottom: 62px` to `bottom: 440px` (clearing the Markets panel's `max-height: 420px` plus a small gap), then re-check in the browser.
- If they don't collide (e.g. because the app only ever shows one bottom-center overlay at a time in practice), leave `#tour-card` unchanged and note that in the commit message.

- [ ] **Step 4: Commit**

```bash
git add style.css
git commit -m "feat: resize and reposition the Markets panel into the space the filter panel vacated"
```

(If Step 3 required a `#tour-card` adjustment, that change is included in this same commit — it's a direct consequence of the Markets panel resize, not a separate task.)

---

## Task 5: Manual visual QA

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Start the app**

Run: `node server.js` (requires the `h2grid-db` Docker container from `docker-compose.yml` to already be up — `docker compose up -d`). Open `http://localhost:8000/`.

- [ ] **Step 2: Check each feature visually**

- Globe is now unobstructed at the bottom — no panel sits over it by default.
- Left rail: below the layer icons and the `web` icon, three new small icons (Status/Region/Color). Click one — a glass flyout panel opens level with that icon, to its right, with the same tooltip-flyout visual language as the sidebar tooltips. Click a different filter icon — the first flyout closes, the new one opens. Click the same icon again, or click elsewhere on the page — the open flyout closes. Picking a filter option (e.g. "Live" under Status) actually filters the globe's markers, same as before.
- Top ribbon: the search icon now sits inline in the ribbon's right zone, before "Analytics". Click or press Cmd/Ctrl+K — it expands into a text input as before. Type a query that matches a facility (e.g. "kobe") — **the results dropdown is now visible** (this was broken before this plan), listing matching facilities, positioned just below the search field, not clipped away.
- Click the ribbon's "Markets" button — the popup panel now appears larger and positioned where the old filter panel used to sit (bottom-center, closer to the bottom edge). Confirm it doesn't look cramped or cut off.
- Select a region filter (opens the AI Regional Overview panel, top-right) — confirm it no longer has anything overlapping it now that search isn't a floating island anymore.

- [ ] **Step 3: Report back**

If anything looks visually off (flyout misaligned with its icon, search results dropdown positioned oddly on resize, Markets panel colliding with something), note it — that's a follow-up polish task, not a reason to revert the plan's committed work.

## Non-goals (carried over from the spec)

- No changes to `applyFilters`, `TOGGLE_MAP`, `REGION_GROUPS`, or any filter *logic* itself.
- No changes to search matching/ranking logic beyond where results render and how position is computed.
- No stacking/repositioning logic for `#detail-card`/`#regional-ai-panel` — already fully mutually exclusive in existing code, so no work needed there.
- The Markets popup panel's *content* (tickers, chart) and the future energy-news feed are out of scope — covered by a separate spec.
- No localStorage/persistence of which flyout was last open, or of panel positions — everything resets to defaults on page load.
