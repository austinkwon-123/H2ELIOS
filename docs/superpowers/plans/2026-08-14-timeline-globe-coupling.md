# Timeline Year Drives The Globe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the selected timeline year filter the globe, so that moving one control visibly updates the 3D capacity spikes, the flat project markers and the counts together.

**Architecture:** The year is already derived per-feature (`onlineYear`) and the 3D spikes already honour it. Three pieces are missing: the derivation must run before the map builds its layers, `currentFilter()` must carry a year term, and a store subscription must re-apply filters when the year changes. A year control in the Explore sidebar then makes the whole chain visible in one screen.

**Tech Stack:** Vanilla JS classic scripts (no modules, no build step), MapLibre GL v5, a bespoke `H2Store`, Playwright for UI tests, `node --test` for pure logic.

## Global Constraints

- No new runtime dependencies, no bundler, no ES modules. Classic scripts sharing one global lexical scope.
- Load order is dependency order and is declared in `index.html`. A file that must run before `01-core.js` goes in the data block.
- `parseOnlineYear`'s behaviour must not change: first `20\d{2}` found in `updated`/`date`, defaulting to `2020`. It is a pre-existing modelling choice and is explicitly out of scope.
- Hub layers keep their status+region-only filter. They are not dated projects.
- The live API tier (`api-projects*` source) carries no date field and is not filtered by `applyFilters()`. It stays visible at every year.
- Comments in this codebase explain *why*, not *what*. Match that register or write none.
- Map assertions must wait on a settled map, never a fixed timeout. Sampling early reports an incompletely populated style.

---

### Task 1: Move the year derivation ahead of layer creation

`preProcessDatasets()` lives in `js/17-visualization.js` and runs from `initVisualizationModule()` on DOMContentLoaded. `js/01-core.js` builds the point layers inside `map.on("load")`. Whichever wins the race decides whether MapLibre's copy of each feature carries `onlineYear` — today it usually does, by luck. Task 2 makes correctness depend on it, so it moves to a file that provably runs first.

**Files:**
- Create: `js/data-derive.js`
- Modify: `index.html` (data script block, currently lines 319-328)
- Modify: `js/17-visualization.js:24-30` (remove `parseOnlineYear`), `js/17-visualization.js:63-86` (remove `preProcessDatasets`), `js/17-visualization.js:714-718` (remove the call)
- Test: `tests/derive.test.js`

**Interfaces:**
- Consumes: nothing.
- Produces: globals `parseOnlineYear(updatedStr) -> number` and `preProcessDatasets() -> void`. After `preProcessDatasets()` runs, every feature in `D.upstream`, `D.production`, `D.manufacturing`, `D.storagePoints`, `D.pipelines`, `D.endUse`, `D.fuelingStationsFallback` and `window.IEA_DATA` has a numeric `properties.onlineYear`.

- [ ] **Step 1: Write the failing test**

Create `tests/derive.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadDerive(datasets) {
  const context = vm.createContext({
    D: datasets.D,
    window: { IEA_DATA: datasets.IEA_DATA },
    console, Object, Array, Number, String, Boolean, Math, parseInt
  });
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "data-derive.js"), "utf8");
  vm.runInContext(source, context, { filename: "data-derive.js" });
  return context;
}

function feature(properties) {
  return { type: "Feature", geometry: { type: "Point", coordinates: [0, 0] }, properties };
}

test("parseOnlineYear reads the first four-digit year and defaults to 2020", () => {
  const context = loadDerive({ D: {}, IEA_DATA: null });
  assert.equal(context.parseOnlineYear("commissioned 2027"), 2027);
  assert.equal(context.parseOnlineYear("2031-04-01"), 2031);
  assert.equal(context.parseOnlineYear("no date here"), 2020);
  assert.equal(context.parseOnlineYear(null), 2020);
  assert.equal(context.parseOnlineYear(undefined), 2020);
});

test("preProcessDatasets stamps onlineYear on every curated collection and on IEA", () => {
  const datasets = {
    D: {
      upstream: { features: [feature({ name: "U", updated: "2029" })] },
      production: { features: [feature({ name: "P", date: "2024-06-01" })] },
      manufacturing: { features: [feature({ name: "M" })] },
      storagePoints: { features: [feature({ name: "S", updated: "2033" })] },
      pipelines: { features: [feature({ name: "L", updated: "2026" })] },
      endUse: { features: [feature({ name: "E" })] },
      fuelingStationsFallback: { features: [feature({ name: "F", updated: "2022" })] }
    },
    IEA_DATA: { features: [feature({ name: "I", updated: "2035" })] }
  };
  const context = loadDerive(datasets);
  context.preProcessDatasets();
  assert.equal(datasets.D.upstream.features[0].properties.onlineYear, 2029);
  assert.equal(datasets.D.production.features[0].properties.onlineYear, 2024);
  assert.equal(datasets.D.manufacturing.features[0].properties.onlineYear, 2020);
  assert.equal(datasets.D.storagePoints.features[0].properties.onlineYear, 2033);
  assert.equal(datasets.D.pipelines.features[0].properties.onlineYear, 2026);
  assert.equal(datasets.D.endUse.features[0].properties.onlineYear, 2020);
  assert.equal(datasets.D.fuelingStationsFallback.features[0].properties.onlineYear, 2022);
  assert.equal(datasets.IEA_DATA.features[0].properties.onlineYear, 2035);
});

test("preProcessDatasets tolerates missing collections", () => {
  const datasets = { D: { production: null, upstream: { features: [] } }, IEA_DATA: null };
  const context = loadDerive(datasets);
  assert.doesNotThrow(() => context.preProcessDatasets());
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/derive.test.js`
Expected: FAIL — `ENOENT` for `js/data-derive.js`.

- [ ] **Step 3: Create `js/data-derive.js`**

```js
/* ==========================================================================
   H2ELIOS · Derived dataset properties
   Runs before 01-core.js builds the map layers. onlineYear used to be derived
   inside 17-visualization.js on DOMContentLoaded, racing map.on("load"): if
   the layers won, MapLibre's copy of each feature had no year and any
   year-based setFilter silently matched nothing. Deriving here makes the
   ordering a property of the load list rather than of who happened to finish
   first.
   ======================================================================= */

// First four-digit year in the record's own date text. 2020 is the floor the
// timeline starts at, so an undated record reads as "already there" rather
// than disappearing from the map.
function parseOnlineYear(updatedStr) {
  if (!updatedStr) return 2020;
  const m = String(updatedStr).match(/20\d{2}/);
  if (m) return parseInt(m[0]);
  return 2020;
}

function preProcessDatasets() {
  const collections = [
    D.upstream, D.production, D.manufacturing, D.storagePoints, D.pipelines, D.endUse, D.fuelingStationsFallback
  ];

  collections.forEach((col) => {
    if (col && Array.isArray(col.features)) {
      col.features.forEach((f) => {
        if (f.properties) {
          f.properties.onlineYear = parseOnlineYear(f.properties.updated || f.properties.date);
        }
      });
    }
  });

  if (window.IEA_DATA && Array.isArray(window.IEA_DATA.features)) {
    window.IEA_DATA.features.forEach((f) => {
      if (f.properties) {
        f.properties.onlineYear = parseOnlineYear(f.properties.updated);
      }
    });
  }
}

preProcessDatasets();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/derive.test.js`
Expected: PASS, 3 tests.

Note: the trailing `preProcessDatasets()` call runs at load. In the test the context defines `D` as `{}`, so the immediate call is a no-op over an empty collection list before each test calls it explicitly with real data.

- [ ] **Step 5: Register the new file in `index.html`**

In the data script block, add `"js/data-derive.js"` as the **last** entry, so every dataset it reads is already defined:

```html
 <!-- data -->
 <script>
   [
     "js/data.js",
     "js/iea-data.js",
     "js/eu-stations-data.js",
     "js/breakeven-data.js",
     "js/news-data.js",
     "js/data-derive.js"
   ].forEach((path) => H2ELIOS_ASSETS.script(path));
 </script>
```

- [ ] **Step 6: Remove the originals from `js/17-visualization.js`**

Delete the `parseOnlineYear` function (with its `// Helper: Parse online year from various formats` comment) and the whole `preProcessDatasets` function. Then in `initVisualizationModule()` remove only the `preProcessDatasets();` line:

```js
function initVisualizationModule() {
  inject3DControls();
  enable3DOnFirstLoad();
}
```

- [ ] **Step 7: Verify nothing else referenced them**

Run: `grep -rn "parseOnlineYear\|preProcessDatasets" js/ index.html`
Expected: matches only in `js/data-derive.js` and `index.html`.

- [ ] **Step 8: Run the full suites to confirm no regression**

Run: `node --test tests/derive.test.js tests/store.test.js`
Expected: PASS.
Run: `npx playwright test tests/focused-redesign.spec.js --reporter=line`
Expected: same pass count as before this task. Record the number.

- [ ] **Step 9: Commit**

```bash
git add js/data-derive.js js/17-visualization.js index.html tests/derive.test.js
git commit -m "refactor: derive onlineYear before the map builds its layers"
```

---

### Task 2: Filter the map by year

**Files:**
- Modify: `js/03-filters.js:43-49` (`currentFilter`)
- Modify: `js/03-filters.js` (add the store subscription at the end of the file)
- Test: `tests/focused-redesign.spec.js`

**Interfaces:**
- Consumes: `properties.onlineYear` from Task 1.
- Produces: `currentFilter()` returns a filter expression that includes a year clause. A `TIMELINE_YEAR_UPDATE` dispatch re-filters the map. No new global names.

- [ ] **Step 1: Write the failing test**

Append to `tests/focused-redesign.spec.js`:

```js
test('the selected year filters the globe, and undated records survive it', async ({ page }) => {
  await open(page);
  if (await page.locator('html').getAttribute('data-map-runtime') === 'offline') test.skip(true, 'no map runtime');

  // The style keeps adding layers for several seconds after "load"; sampling
  // before it settles reports a half-built map.
  await expect.poll(async () => page.evaluate(() =>
    (map.getStyle()?.layers || []).some((l) => l.id === 'production')), { timeout: 20000 }).toBe(true);
  await page.waitForTimeout(3000);

  const countAt = async (year) => {
    await page.evaluate((y) => H2Store.dispatch({ type: 'TIMELINE_YEAR_UPDATE', payload: { year: y } }), year);
    await page.waitForTimeout(700);
    return page.evaluate(() =>
      map.queryRenderedFeatures({ layers: ['production', 'upstream', 'manufacturing', 'storage', 'endUse'].filter((id) => map.getLayer(id)) }).length);
  };

  const early = await countAt(2020);
  const late = await countAt(2035);
  expect(late, 'more projects are online by 2035 than by 2020').toBeGreaterThan(early);

  // parseOnlineYear floors undated records at 2020, so they must be present at
  // the earliest year. If the filter ever drops them the dataset silently shrinks.
  expect(early, 'undated records still render at 2020').toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/focused-redesign.spec.js -g "filters the globe" --reporter=line`
Expected: FAIL — `late` equals `early`, because no filter carries a year.

- [ ] **Step 3: Add the year clause to `currentFilter()`**

Replace `currentFilter()` in `js/03-filters.js`:

```js
function currentFilter() {
  const parts = ["all"];
  if (statusFilter !== "all") parts.push(["==", ["get", "statusClass"], statusFilter]);
  if (regionFilter !== "all") parts.push(regionExpr());
  if (colorFilter) parts.push(["==", ["get", "color"], colorFilter]);
  // A project appears once the selected year reaches its commissioning year.
  // The `!has` branch keeps records that never got an onlineYear on screen:
  // dropping them would shrink the dataset silently rather than visibly, and
  // it is what update3DTowers() already does for the capacity spikes.
  const year = window.H2Store?.getState().timelineYear ?? window.timelineYear;
  if (Number.isFinite(year)) {
    parts.push(["any", ["!", ["has", "onlineYear"]], ["<=", ["get", "onlineYear"], year]]);
  }
  return parts.length > 1 ? parts : null;
}
```

- [ ] **Step 4: Add the store subscription**

At the end of `js/03-filters.js`, after the existing `syncFiltersFromStore();` call:

```js
// The year is a map filter like any other, so every surface that can change it
// — the Timeline slider, the Explore scrubber, the walkthrough — gets correct
// map behaviour from this one subscription instead of remembering to call
// applyFilters itself. applyFilters is reassigned in 17-visualization.js to
// also rebuild the 3D beams, so the spikes follow from here too.
window.H2Store?.subscribe((state) => state.timelineYear, () => {
  window.timelineYear = window.H2Store.getState().timelineYear;
  if (typeof applyFilters === "function") applyFilters();
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx playwright test tests/focused-redesign.spec.js -g "filters the globe" --reporter=line`
Expected: PASS.

- [ ] **Step 6: Run the full UI suite**

Run: `npx playwright test tests/focused-redesign.spec.js --reporter=line`
Expected: previous pass count plus one. Investigate any newly failing test before continuing — several existing tests count map features.

- [ ] **Step 7: Commit**

```bash
git add js/03-filters.js tests/focused-redesign.spec.js
git commit -m "feat: filter map layers by the selected timeline year"
```

---

### Task 3: Delete the vestigial apply path and prove the button works

`applyTimelineFilter()` exists only to copy the year out of the store and call `applyFilters()`. Task 2's subscription does both, at the moment the year actually changes.

**Files:**
- Modify: `js/17-visualization.js:490-494` (remove `applyTimelineFilter` and its `window.` export)
- Modify: `js/09-router.js:163` (remove the guarded call)
- Test: `tests/focused-redesign.spec.js`

**Interfaces:**
- Consumes: the subscription from Task 2.
- Produces: `window.applyTimelineFilter` no longer exists.

- [ ] **Step 1: Write the failing test**

Append to `tests/focused-redesign.spec.js`:

```js
test('Apply year to map changes what the map renders', async ({ page }) => {
  await open(page, 'timeline');
  if (await page.locator('html').getAttribute('data-map-runtime') === 'offline') test.skip(true, 'no map runtime');

  await page.locator('#sandbox-slider').evaluate((input) => {
    input.value = '2020';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#timeline-apply-map').click();
  await expect(page).toHaveURL(/#map$/);
  await expect.poll(async () => page.evaluate(() =>
    (map.getStyle()?.layers || []).some((l) => l.id === 'production')), { timeout: 20000 }).toBe(true);
  await page.waitForTimeout(3000);

  const rendered = () => page.evaluate(() =>
    map.queryRenderedFeatures({ layers: ['production', 'upstream', 'manufacturing', 'storage', 'endUse'].filter((id) => map.getLayer(id)) }).length);
  const at2020 = await rendered();

  await page.evaluate(() => H2Store.dispatch({ type: 'TIMELINE_YEAR_UPDATE', payload: { year: 2035 } }));
  await page.waitForTimeout(700);
  const at2035 = await rendered();

  // The bug this replaces: the button navigated to Explore and left the globe
  // pixel-identical, because nothing filtered on the year it carried.
  expect(at2035).toBeGreaterThan(at2020);
  expect(await page.evaluate(() => typeof window.applyTimelineFilter)).toBe('undefined');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/focused-redesign.spec.js -g "Apply year to map changes" --reporter=line`
Expected: FAIL on the final assertion — `window.applyTimelineFilter` is still `'function'`.

- [ ] **Step 3: Remove `applyTimelineFilter` from `js/17-visualization.js`**

Delete both the function and its export:

```js
function applyTimelineFilter() {
  window.timelineYear = window.H2Store?.getState().timelineYear || window.timelineYear;
  if (typeof applyFilters === "function") applyFilters();
}
window.applyTimelineFilter = applyTimelineFilter;
```

- [ ] **Step 4: Remove the call site in `js/09-router.js:163`**

Delete this line from the double-`requestAnimationFrame` block:

```js
    if (source.year != null && typeof applyTimelineFilter === "function") applyTimelineFilter();
```

Leave the `applyFilters()` line immediately after it — it still re-applies status/region/colour on arrival.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx playwright test tests/focused-redesign.spec.js -g "Apply year to map changes" --reporter=line`
Expected: PASS.

- [ ] **Step 6: Confirm no orphan references**

Run: `grep -rn "applyTimelineFilter" js/ tests/`
Expected: no matches.

- [ ] **Step 7: Commit**

```bash
git add js/17-visualization.js js/09-router.js tests/focused-redesign.spec.js
git commit -m "refactor: drop applyTimelineFilter now the store drives map filtering"
```

---

### Task 4: Year scrubber in the Explore sidebar

Placed in the sidebar rather than floating over the map. Explore already carries four bottom-anchored floats — the comparison tray, the selection chip, the minimized tray and the walkthrough card — and adding a fifth has repeatedly produced overlap bugs. The sidebar also already has the right information architecture: Workspaces, Map layers, Filter. Year is a filter.

**Files:**
- Modify: `index.html` (inside `#sidebar-map-tools`'s sibling area — see Step 3 for the exact anchor)
- Modify: `js/03-filters.js` (wire the control)
- Modify: `style.css` (append the block in Step 5)
- Test: `tests/focused-redesign.spec.js`

**Interfaces:**
- Consumes: the store subscription from Task 2 (the scrubber only dispatches; it never filters the map itself).
- Produces: DOM ids `#explore-year-scrubber` (the `<input type="range">`) and `#explore-year-value` (the readout). A global `wireExploreYearScrubber() -> void`, called from `wireDock()`.

- [ ] **Step 1: Write the failing test**

Append to `tests/focused-redesign.spec.js`:

```js
test('the Explore year scrubber and the Timeline slider stay in sync', async ({ page }) => {
  await open(page);
  await page.evaluate(() => setSidebarExpanded(true, false));
  await page.waitForTimeout(700);

  const scrubber = page.locator('#explore-year-scrubber');
  await expect(scrubber).toBeVisible();
  await expect(page.locator('#explore-year-value')).toHaveText('2026');

  await scrubber.evaluate((input) => {
    input.value = '2032';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#explore-year-value')).toHaveText('2032');
  expect(await page.evaluate(() => H2Store.getState().timelineYear)).toBe(2032);

  // Both surfaces write through the store and read back from it, so neither
  // can drift from the other.
  await page.evaluate(() => navigateTo('timeline'));
  await page.waitForTimeout(1200);
  expect(await page.locator('#sandbox-slider').inputValue()).toBe('2032');

  await page.locator('#sandbox-slider').evaluate((input) => {
    input.value = '2023';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.evaluate(() => navigateTo('map'));
  await page.waitForTimeout(1200);
  expect(await page.locator('#explore-year-scrubber').inputValue()).toBe('2023');
  await expect(page.locator('#explore-year-value')).toHaveText('2023');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx playwright test tests/focused-redesign.spec.js -g "year scrubber" --reporter=line`
Expected: FAIL — `#explore-year-scrubber` not found.

- [ ] **Step 3: Add the markup to `index.html`**

`initSpatialShell()` moves `#layer-dock` into `#sidebar-map-tools`. Put the scrubber in the same slot so it travels with the dock and is governed by the same collapsed-rail rules. Insert immediately **after** the closing `</nav>` of `#layer-dock`, still inside `#page-map`:

```html
<!-- Explore year scrubber. Writes through the store; the subscription in
     03-filters.js is what re-filters the map, so this control owns no state
     of its own and cannot drift from the Timeline workspace's slider. -->
<div class="glass" id="explore-year" aria-label="Timeline year">
  <div class="explore-year-head">
    <span class="explore-year-caption">Year</span>
    <span id="explore-year-value">2026</span>
  </div>
  <input id="explore-year-scrubber" class="temporal-slider" type="range"
         min="2020" max="2035" step="1" value="2026"
         aria-label="Filter the map to projects online by this year" />
</div>
```

- [ ] **Step 4: Move it into the sidebar slot**

In `js/23-spatial-shell.js`, `initSpatialShell()` currently does:

```js
  if (sidebarSlot && layerDock) sidebarSlot.appendChild(layerDock);
```

Add directly beneath it:

```js
  const yearScrubber = document.getElementById("explore-year");
  if (sidebarSlot && yearScrubber) sidebarSlot.appendChild(yearScrubber);
```

- [ ] **Step 5: Style it**

Append to `style.css`:

```css
/* ---------- Explore year scrubber ---------- */
#explore-year {
  margin: 10px 0 2px;
  padding: 9px 10px 11px;
  background: var(--material-control);
  border: 1px solid var(--separator);
  border-radius: 11px;
}
.explore-year-head {
  display: flex; align-items: baseline; justify-content: space-between;
  margin-bottom: 8px;
}
.explore-year-caption {
  color: var(--text-tertiary);
  font-size: 9.5px; letter-spacing: 0.06em; text-transform: uppercase;
}
#explore-year-value {
  color: var(--text-primary);
  font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums;
}
#explore-year-scrubber { width: 100%; }
/* The collapsed rail is 56px wide, where a 16-stop slider is unusable. Keep
   the year readable and drop the control, matching how the dock's own labels
   collapse rather than shrinking a target below its usable size. */
body.sidebar-collapsed #explore-year {
  padding: 7px 4px;
  text-align: center;
}
body.sidebar-collapsed .explore-year-caption,
body.sidebar-collapsed #explore-year-scrubber { display: none; }
body.sidebar-collapsed #explore-year-value { font-size: 11px; }
```

- [ ] **Step 6: Wire it in `js/03-filters.js`**

Add the function, and call it from the end of `wireDock()`:

```js
function wireExploreYearScrubber() {
  const scrubber = document.getElementById("explore-year-scrubber");
  const readout = document.getElementById("explore-year-value");
  if (!scrubber || !readout) return;

  const render = (year) => {
    scrubber.value = String(year);
    readout.textContent = String(year);
  };

  scrubber.addEventListener("input", () => {
    window.H2Store?.dispatch({ type: "TIMELINE_YEAR_UPDATE", payload: { year: parseInt(scrubber.value, 10) } });
  });
  // Render from the store rather than from the input's own value, so the
  // Timeline slider moving this control looks identical to a user dragging it.
  window.H2Store?.subscribe((state) => state.timelineYear, render);
  render(window.H2Store?.getState().timelineYear ?? 2026);
}
```

In `wireDock()`, change the final line from `syncDockLayers();` to:

```js
  syncDockLayers();
  wireExploreYearScrubber();
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npx playwright test tests/focused-redesign.spec.js -g "year scrubber" --reporter=line`
Expected: PASS.

- [ ] **Step 8: Verify the scrubber actually moves the globe, by eye**

Start the preview and load Explore at 1440x900. Expand the sidebar. Drag the year from 2020 to 2035 and confirm the capacity spikes and the flat markers both grow. Take a screenshot at each end.

- [ ] **Step 9: Run every suite**

Run: `npx playwright test tests/focused-redesign.spec.js --reporter=line`
Run: `node --test tests/derive.test.js tests/store.test.js`
Expected: all pass. Record the counts.

- [ ] **Step 10: Commit**

```bash
git add index.html js/03-filters.js js/23-spatial-shell.js style.css tests/focused-redesign.spec.js
git commit -m "feat: add a year scrubber to Explore"
```

---

## Self-review notes

Checked against `docs/superpowers/specs/2026-08-14-timeline-globe-coupling-design.md`:

- Spec §1 (derivation reaches the sources) → Task 1.
- Spec §2 (year term, `!has` branch, hubs untouched) → Task 2. Hubs are covered by omission: `applyFilters()` builds `hubParts` separately and Task 2 does not touch it.
- Spec §3 (store subscription, delete `applyTimelineFilter`) → Tasks 2 and 3.
- Spec §4 (Explore scrubber) → Task 4.
- Spec testing bullets → Task 2 Step 1 (count increases, undated survive), Task 3 Step 1 (the button changes the map), Task 4 Step 1 (both surfaces stay in sync).
- Spec non-goals: `parseOnlineYear` is copied verbatim in Task 1 Step 3, unchanged. The API tier is never added to `applyFilters()`'s target list.

Names used consistently throughout: `parseOnlineYear`, `preProcessDatasets`, `currentFilter`, `applyFilters`, `wireExploreYearScrubber`, `#explore-year-scrubber`, `#explore-year-value`.
