# Right-Side Panel Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `#detail-card`, `#regional-ai-panel`, and `#markets-panel` fully mutually exclusive (opening any one auto-closes whichever other is open) and give them one shared, larger position/size slot on the right side instead of three different rectangles.

**Architecture:** A shared `.right-panel-slot` CSS class replaces each panel's individual position/size rules. Each panel gets a proper close function (`closeDetailPanel()`, `closeRegionalAIPanel()`, `closeMarketsPanel()`) that wraps its existing close-time side effects (clearing map selection, stopping stock-ticker polling, etc.). A single `closeOtherRightPanels(exceptId)` coordinator in `js/01-core.js` calls whichever close functions don't match the panel being opened, replacing the two existing hardcoded bilateral monkey-patches between detail-card and the AI panel.

**Tech Stack:** Vanilla JS (classic scripts, shared global scope), vanilla CSS using the existing `:root` design tokens in `style.css`. No build step, no new dependencies.

## Global Constraints

- Classic scripts sharing one global lexical scope — do not wrap new code in IIFEs/ES-modules (see README.md "Editing rules").
- No build step, no new external dependencies.
- Test harness: `node js/smoke-test.js` (needs `jsdom` at `/tmp/node_modules/jsdom`). **Baseline:** currently reports `9 FAILURES`, all pre-existing and unrelated (Tools-tab calculator edge cases). Do not try to fix those. Every assertion this plan adds must PASS; total failures must not exceed 9.
- `closeOtherRightPanels()` must call each panel's real close function (not just toggle `hidden`) — `closeMarketsPanel()` in particular must stop the polling interval (`stopMarketsPolling()`) and un-mark the ribbon button's `.active` state, or closing Markets from another panel opening would leave stock-ticker polling running invisibly in the background.
- `js/01-core.js` defines `closeOtherRightPanels()` but only *calls into* `closeDetailPanel`/`closeRegionalAIPanel`/`closeMarketsPanel`, which are defined later in load order (`js/05-detail.js`, `js/16-ai-features.js`, `js/08-analytics.js`). This is safe — classic scripts share one global scope, and `closeOtherRightPanels()` isn't *called* until user interaction happens well after all scripts have loaded. The codebase already relies on this pattern (`applyFilters()` in `03-filters.js` calls `renderSearchResults()`, defined later in `04-search.js`).
- No changes to `#analytics-panel` (left side, independently toggled, out of scope) or to what any panel renders/contains.

---

## Task 1: Shared right-panel CSS slot

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Modify: `js/smoke-test.js`

**Interfaces:**
- Produces: `.right-panel-slot` CSS class (`top: 74px; right: 14px; width: 400px; max-height: calc(100vh - 130px);`) applied to `#detail-card`, `#regional-ai-panel`, `#markets-panel`.

- [ ] **Step 1: Add the failing assertions to smoke-test.js first**

Find:

```js
  // Search moves into the ribbon; results-dropdown clip fix (Task 3 of the map-layout-reorganization plan)
  ok(doc.getElementById("ribbon-zone-c").contains(doc.getElementById("search-capsule")), "#search-capsule now lives inside #ribbon-zone-c");
  ok(!doc.getElementById("search-capsule").contains(doc.getElementById("search-results")), "#search-results is no longer a descendant of #search-capsule (was clipped by its overflow:hidden)");
```

Add immediately after it:

```js

  // Shared right-panel CSS slot (Task 1 of the right-panel-manager plan)
  ["detail-card", "regional-ai-panel", "markets-panel"].forEach((id) => {
    const el = doc.getElementById(id);
    ok(el.classList.contains("right-panel-slot"), `#${id} carries the shared .right-panel-slot class`);
  });
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node js/smoke-test.js`
Expected: `FAIL  #detail-card carries the shared .right-panel-slot class` and the other two also FAIL.

- [ ] **Step 3: Add the class to all three panel elements**

In `index.html`, find:

```html
<div class="glass" id="detail-card" hidden>
```

Replace with:

```html
<div class="glass right-panel-slot" id="detail-card" hidden>
```

Find:

```html
<div class="glass" id="markets-panel" hidden>
```

Replace with:

```html
<div class="glass right-panel-slot" id="markets-panel" hidden>
```

Find:

```html
 <div class="glass" id="regional-ai-panel" hidden>
```

Replace with:

```html
 <div class="glass right-panel-slot" id="regional-ai-panel" hidden>
```

- [ ] **Step 4: Add the shared CSS class and strip the now-redundant per-panel position/size rules**

In `style.css`, find:

```css
/* ---------- Inspector (right): data terminal ---------- */
#detail-card {
  top: 74px; right: 14px;
  width: 320px; max-height: calc(100vh - 130px);
  overflow-y: auto;
  padding: 16px;
  background: var(--panel-strong);
  animation: slideIn 0.22s ease;
```

Replace with:

```css
/* Shared right-side "slot": detail-card, regional-ai-panel, and
   markets-panel are fully mutually exclusive (see
   closeOtherRightPanels() in js/01-core.js) - at most one is ever
   visible, so all three claim the same position/size instead of each
   having their own smaller rectangle. */
.right-panel-slot {
  top: 74px; right: 14px;
  width: 400px;
  max-height: calc(100vh - 130px);
}

/* ---------- Inspector (right): data terminal ---------- */
#detail-card {
  overflow-y: auto;
  padding: 16px;
  background: var(--panel-strong);
  animation: slideIn 0.22s ease;
```

Then find:

```css
#regional-ai-panel {
  top: 74px;
  right: 64px;
  width: 320px;
  max-height: calc(100vh - 130px);
  overflow-y: auto;
  padding: 16px;
  background: var(--panel-strong);
  animation: slideInRight 0.22s ease;
  scrollbar-width: thin;
  scrollbar-color: var(--text-faint) transparent;
}
```

Replace with:

```css
#regional-ai-panel {
  overflow-y: auto;
  padding: 16px;
  background: var(--panel-strong);
  animation: slideInRight 0.22s ease;
  scrollbar-width: thin;
  scrollbar-color: var(--text-faint) transparent;
}
```

Then find:

```css
#markets-panel {
  bottom: 14px; right: 14px;
  width: min(400px, calc(100vw - 28px));
  max-height: 420px;
  overflow-y: auto;
  padding: 16px;
  background: var(--panel-strong);
  box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.02), 0 8px 32px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.22s ease;
  scrollbar-width: thin; scrollbar-color: var(--text-faint) transparent;
}
@keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
```

Replace with:

```css
#markets-panel {
  overflow-y: auto;
  padding: 16px;
  background: var(--panel-strong);
  box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.02), 0 8px 32px rgba(0, 0, 0, 0.5);
  animation: slideUp 0.22s ease;
  scrollbar-width: thin; scrollbar-color: var(--text-faint) transparent;
}
@keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
```

(`#markets-panel` moves from its current bottom-right spot back into the
shared top-right slot alongside the other two — this is intentional, not
a regression: the whole point of this plan is that these three never
show at once anymore, so they no longer need separate positions to
avoid colliding.)

- [ ] **Step 5: Run the test and confirm it passes**

Run: `node js/smoke-test.js`
Expected: all 3 assertions added in Step 1 `PASS`. Total failure count is still 9.

- [ ] **Step 6: Commit**

```bash
git add index.html style.css js/smoke-test.js
git commit -m "feat: unify detail-card/regional-ai-panel/markets-panel into one shared right-side slot"
```

---

## Task 2: Extract close functions

**Files:**
- Modify: `js/05-detail.js`
- Modify: `js/16-ai-features.js`
- Modify: `js/08-analytics.js`
- Modify: `js/smoke-test.js`

**Interfaces:**
- Produces: `closeDetailPanel()`, `closeRegionalAIPanel()`, `closeMarketsPanel()` — each a standalone, callable, no-argument function that fully closes its panel including any side effects (map selection clearing, stock-ticker polling, button `.active` state). Task 3's coordinator calls these by name.
- This task is a pure refactor — extracting existing inline close logic into named functions and wiring the existing close buttons to call them. No new user-visible behavior yet (mutual exclusion is Task 3).

- [ ] **Step 1: Add the failing assertions to smoke-test.js first**

Find (the block added in Task 1):

```js
  // Shared right-panel CSS slot (Task 1 of the right-panel-manager plan)
  ["detail-card", "regional-ai-panel", "markets-panel"].forEach((id) => {
    const el = doc.getElementById(id);
    ok(el.classList.contains("right-panel-slot"), `#${id} carries the shared .right-panel-slot class`);
  });
```

Add immediately after it:

```js

  // Extracted close functions (Task 2 of the right-panel-manager plan)
  ok(typeof window.closeDetailPanel === "function", "closeDetailPanel() is defined");
  ok(typeof window.closeRegionalAIPanel === "function", "closeRegionalAIPanel() is defined");
  ok(typeof window.closeMarketsPanel === "function", "closeMarketsPanel() is defined");
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node js/smoke-test.js`
Expected: `FAIL  closeDetailPanel() is defined` and the other two also FAIL.

- [ ] **Step 3: Extract `closeDetailPanel()` in js/05-detail.js**

Find:

```js
function wireDetailClose() {
  document.getElementById("detail-close").addEventListener("click", () => {
    document.getElementById("detail-card").hidden = true;
    selectedName = null;
    map.getSource("selection").setData(emptyFC());
  });
}
```

Replace with:

```js
function closeDetailPanel() {
  document.getElementById("detail-card").hidden = true;
  selectedName = null;
  map.getSource("selection").setData(emptyFC());
}

function wireDetailClose() {
  document.getElementById("detail-close").addEventListener("click", closeDetailPanel);
}
```

- [ ] **Step 4: Extract `closeRegionalAIPanel()` in js/16-ai-features.js**

Find:

```js
function wireRegionalAIClose() {
  const closeBtn = document.getElementById("regional-ai-close");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      const panel = document.getElementById("regional-ai-panel");
      if (panel) panel.hidden = true;
    });
  }
}
```

Replace with:

```js
function closeRegionalAIPanel() {
  const panel = document.getElementById("regional-ai-panel");
  if (panel) panel.hidden = true;
}

function wireRegionalAIClose() {
  const closeBtn = document.getElementById("regional-ai-close");
  if (closeBtn) closeBtn.addEventListener("click", closeRegionalAIPanel);
}
```

- [ ] **Step 5: Extract `closeMarketsPanel()` in js/08-analytics.js**

Find:

```js
function wireMarketsToggle() {
  const btn = document.getElementById("markets-btn");
  const panel = document.getElementById("markets-panel");
  if (!btn || !panel) return;
  btn.addEventListener("click", () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    btn.classList.toggle("active", opening);
    if (opening) {
      if (!marketsChartLoaded) {
        initMarketsChart();
        marketsChartLoaded = true;
      }
      startMarketsPolling();
    } else {
      stopMarketsPolling();
    }
  });
}
```

Replace with:

```js
function closeMarketsPanel() {
  const btn = document.getElementById("markets-btn");
  const panel = document.getElementById("markets-panel");
  if (!panel.hidden) {
    panel.hidden = true;
    btn.classList.remove("active");
    stopMarketsPolling();
  }
}

function wireMarketsToggle() {
  const btn = document.getElementById("markets-btn");
  const panel = document.getElementById("markets-panel");
  if (!btn || !panel) return;
  btn.addEventListener("click", () => {
    if (panel.hidden) {
      panel.hidden = false;
      btn.classList.add("active");
      if (!marketsChartLoaded) {
        initMarketsChart();
        marketsChartLoaded = true;
      }
      startMarketsPolling();
    } else {
      closeMarketsPanel();
    }
  });
}
```

(The `closeOtherRightPanels("markets-panel")` call in the opening branch
is added in Task 3, not here — this task only extracts the closing
logic into a named function without changing opening behavior yet.)

- [ ] **Step 6: Run the test and confirm it passes**

Run: `node js/smoke-test.js`
Expected: the 3 assertions added in Step 1 `PASS`, and every pre-existing panel-related assertion (detail sheet opens/closes, markets panel opens/closes on click, analytics panel opens/closes, regional AI panel appears on region select) still `PASS` unchanged — this step is a refactor, not a behavior change.

- [ ] **Step 7: Commit**

```bash
git add js/05-detail.js js/16-ai-features.js js/08-analytics.js js/smoke-test.js
git commit -m "refactor: extract closeDetailPanel/closeRegionalAIPanel/closeMarketsPanel as standalone functions"
```

---

## Task 3: Coordinator + mutual exclusion

**Files:**
- Modify: `js/01-core.js`
- Modify: `js/05-detail.js`
- Modify: `js/16-ai-features.js`
- Modify: `js/08-analytics.js`
- Modify: `js/smoke-test.js`

**Interfaces:**
- Consumes: `closeDetailPanel()`, `closeRegionalAIPanel()`, `closeMarketsPanel()` from Task 2.
- Produces: `closeOtherRightPanels(exceptId)` in `js/01-core.js`, called from `showDetail()` (05-detail.js), `updateRegionalAIPanel()` (16-ai-features.js), and `wireMarketsToggle()`'s opening branch (08-analytics.js).

- [ ] **Step 1: Add the failing assertions to smoke-test.js first**

Find (the block added in Task 2):

```js
  // Extracted close functions (Task 2 of the right-panel-manager plan)
  ok(typeof window.closeDetailPanel === "function", "closeDetailPanel() is defined");
  ok(typeof window.closeRegionalAIPanel === "function", "closeRegionalAIPanel() is defined");
  ok(typeof window.closeMarketsPanel === "function", "closeMarketsPanel() is defined");
```

Add immediately after it:

```js

  // Mutual exclusion coordinator (Task 3 of the right-panel-manager plan)
  ok(typeof window.closeOtherRightPanels === "function", "closeOtherRightPanels() is defined");
  const detailCardEl = doc.getElementById("detail-card");
  const aiPanelEl = doc.getElementById("regional-ai-panel");
  const marketsPanelEl = doc.getElementById("markets-panel");
  const marketsBtnEl = doc.getElementById("markets-btn");

  // Open detail-card (via search), then AI panel - detail-card should close.
  click(doc.querySelector('#region-seg .seg-btn[data-region="all"]'));
  const kobeBox = doc.getElementById("network-search");
  kobeBox.focus();
  kobeBox.value = "kobe";
  kobeBox.dispatchEvent(new window.Event("input", { bubbles: true }));
  click(doc.getElementById("search-results").querySelector(".fac-item"));
  ok(!detailCardEl.hidden, "detail-card opens from search click");
  click(doc.querySelector('#region-seg .seg-btn[data-region="apac"]'));
  ok(!aiPanelEl.hidden, "AI panel opens on region select");
  ok(detailCardEl.hidden, "opening the AI panel closes detail-card");

  // Open markets - AI panel should close, button state and polling cleanup tracked via hidden/active.
  click(marketsBtnEl);
  ok(!marketsPanelEl.hidden, "markets panel opens on click");
  ok(marketsBtnEl.classList.contains("active"), "markets button gets .active while open");
  ok(aiPanelEl.hidden, "opening markets closes the AI panel");

  // Re-open detail-card - markets should close.
  click(doc.getElementById("search-results").querySelector(".fac-item"));
  ok(!detailCardEl.hidden, "detail-card re-opens from search click");
  ok(marketsPanelEl.hidden, "opening detail-card closes markets");
  ok(!marketsBtnEl.classList.contains("active"), "markets button loses .active once markets closes");

  // Clean up: close detail-card and clear the region filter for later assertions.
  click(doc.getElementById("detail-close"));
  click(doc.querySelector('#region-seg .seg-btn[data-region="all"]'));
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node js/smoke-test.js`
Expected: `FAIL  closeOtherRightPanels() is defined` and the following new assertions also FAIL (no coordinator exists yet, so opening one panel doesn't close the others).

- [ ] **Step 3: Add the coordinator to js/01-core.js**

Find:

```js
map.addControl(new ResetViewControl(), "top-left");


// ---- State ---------------------------------------------------------------
```

Replace with:

```js
map.addControl(new ResetViewControl(), "top-left");

function closeOtherRightPanels(exceptId) {
  const closers = {
    "detail-card": closeDetailPanel,
    "regional-ai-panel": closeRegionalAIPanel,
    "markets-panel": closeMarketsPanel
  };
  Object.entries(closers).forEach(([id, close]) => {
    if (id !== exceptId) {
      const el = document.getElementById(id);
      if (el && !el.hidden) close();
    }
  });
}


// ---- State ---------------------------------------------------------------
```

- [ ] **Step 4: Call the coordinator from `showDetail()` in js/05-detail.js**

Find:

```js
function showDetail(p) {
  const card = document.getElementById("detail-card");
  const el = document.getElementById("detail-content");
  const c = COLORS[p.color] || "#9ca3af";
```

Replace with:

```js
function showDetail(p) {
  closeOtherRightPanels("detail-card");
  const card = document.getElementById("detail-card");
  const el = document.getElementById("detail-content");
  const c = COLORS[p.color] || "#9ca3af";
```

- [ ] **Step 5: Call the coordinator from `updateRegionalAIPanel()` and remove the old ad-hoc exclusion in js/16-ai-features.js**

Find:

```js
  if (regionFilter === "all") {
    panel.hidden = true;
    return;
  }

  // Mutual exclusion: Close the project detail card when the regional overview opens
  const detailCard = document.getElementById("detail-card");
  if (detailCard) {
    detailCard.hidden = true;
    selectedName = null;
    if (map.getSource && map.getSource("selection")) {
      map.getSource("selection").setData({ type: "FeatureCollection", features: [] });
    }
  }

  panel.hidden = false;
```

Replace with:

```js
  if (regionFilter === "all") {
    panel.hidden = true;
    return;
  }

  closeOtherRightPanels("regional-ai-panel");
  panel.hidden = false;
```

Then find:

```js
// Patch the global showDetail function (from js/05-detail.js) to inject AI engagement analysis
const _showDetail = showDetail;
showDetail = function (p) {
  // Call original renderer first
  _showDetail(p);

  // Mutual exclusion: Close the regional AI panel when the project inspector opens
  const aiPanel = document.getElementById("regional-ai-panel");
  if (aiPanel) aiPanel.hidden = true;

  const el = document.getElementById("detail-content");
  if (!el) return;
```

Replace with:

```js
// Patch the global showDetail function (from js/05-detail.js) to inject AI engagement analysis
const _showDetail = showDetail;
showDetail = function (p) {
  // Call original renderer first - it already calls closeOtherRightPanels("detail-card"),
  // which covers closing the AI panel, so no separate exclusion needed here.
  _showDetail(p);

  const el = document.getElementById("detail-content");
  if (!el) return;
```

- [ ] **Step 6: Call the coordinator from `wireMarketsToggle()`'s opening branch in js/08-analytics.js**

Find:

```js
  btn.addEventListener("click", () => {
    if (panel.hidden) {
      panel.hidden = false;
      btn.classList.add("active");
      if (!marketsChartLoaded) {
```

Replace with:

```js
  btn.addEventListener("click", () => {
    if (panel.hidden) {
      closeOtherRightPanels("markets-panel");
      panel.hidden = false;
      btn.classList.add("active");
      if (!marketsChartLoaded) {
```

- [ ] **Step 7: Run the test and confirm it passes**

Run: `node js/smoke-test.js`
Expected: all assertions added in Step 1 `PASS`. Total failure count is still 9 (the pre-existing, unrelated baseline).

- [ ] **Step 8: Commit**

```bash
git add js/01-core.js js/05-detail.js js/16-ai-features.js js/08-analytics.js js/smoke-test.js
git commit -m "feat: make detail-card/regional-ai-panel/markets-panel fully mutually exclusive"
```

---

## Task 4: Manual visual QA

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Start the app**

Run: `node server.js` (requires the `h2grid-db` Docker container from `docker-compose.yml` to already be up — `docker compose up -d`). Open `http://localhost:8000/`.

- [ ] **Step 2: Check each transition visually**

- Click a facility on the globe — detail-card opens in the top-right slot, larger than before (400px wide).
- With detail-card open, select a region filter (e.g. "Asia-Pac") — detail-card closes, the AI Regional Overview panel opens in the same slot.
- With the AI panel open, click the ribbon's "Markets" button — the AI panel closes, Markets panel opens in the same top-right slot (no longer bottom-right), same larger size, chart has more room than before.
- With Markets open, click a different facility — Markets closes (confirm the Markets button in the ribbon loses its active/highlighted state too), detail-card opens.
- Click Markets again while nothing else is open — it should still open/close normally on its own (self-toggle still works, not just cross-panel closing).
- Confirm `#analytics-panel` (left side, Network/Intel) is unaffected — it can be open at the same time as any of the three right-side panels, since it's a separate, independent panel out of this plan's scope.

- [ ] **Step 3: Report back**

If anything looks visually off (wrong slot size, a panel not closing when it should, the Markets chart looking cramped or overflowing at 400px), note it — that's a follow-up polish task, not a reason to revert the plan's committed work.

## Non-goals (carried over from the spec)

- No changes to what any panel renders/contains, or to facility/region/market data fetching.
- No changes to `#analytics-panel` (left side, independently toggled) — out of scope.
- No persistence of "which panel was last open" across reloads.
- The Markets news feed (energy-industry news content) is a separate, already-deferred spec — not addressed here.
