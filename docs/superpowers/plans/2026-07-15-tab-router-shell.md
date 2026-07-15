# Tab/Router Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn H2Grid from a single map page into a multi-tab app — wrap all existing map/HUD content into a `#page-map` section, add 6 empty placeholder pages, and add a hash-based router with a persistent tab nav — without changing any existing feature's behavior.

**Architecture:** Two additive pieces on top of the existing classic-script codebase: (1) an HTML restructuring that wraps current body content in `<section id="page-map">` and adds 6 sibling placeholder `<section>`s plus a persistent `#tab-nav`, and (2) a new `js/09-router.js` module that shows/hides pages based on `location.hash`, keeps the tab nav's active state in sync, and calls `map.resize()` when returning to the Map tab (MapLibre can't measure its canvas while `display:none`).

**Tech Stack:** Vanilla JS (classic scripts, shared global scope), no build step, no new dependencies.

## Global Constraints

- Classic scripts sharing one global lexical scope — do not wrap new modules in IIFEs/ES-modules (see README.md "Editing rules").
- Load order = dependency order — `js/09-router.js` loads last (after `08-analytics.js`) since it reads the global `map` from `js/01-core.js` for the resize-on-return behavior.
- No build step, no new external dependencies.
- This spec builds the shell only — the 6 placeholder pages render static "Coming soon" content. No new data, no AI integration, no changes to any existing feature's logic (only its DOM position, wrapped inside `#page-map`).
- `#tab-nav` must be a sibling of the `.page` sections, never a child of one — a child would be hidden along with its parent page, breaking navigation entirely.

---

## Task 1: Page/nav HTML structure + CSS

**Files:**
- Modify: `index.html`
- Modify: `style.css`
- Modify: `js/smoke-test.js`

**Interfaces:**
- Consumes: nothing new.
- Produces: DOM structure `js/09-router.js` (Task 2) depends on — `#tab-nav` with `.tab-btn[data-route]` buttons, and 7 `.page` sections with ids `page-map`, `page-market`, `page-technology`, `page-demand-transport`, `page-policy`, `page-companies`, `page-tools`.

- [ ] **Step 1: Add the failing assertions to smoke-test.js first**

Find the line (existing, near the end of the assertion block):

```js
  ok(doc.getElementById("api-status").className.includes("fallback"), "AFDC failure -> fallback pill");
```

Add immediately after it (still inside the same `setTimeout` callback, before the `console.log`/`process.exit` lines):

```js

  // Tab/router shell — page structure (Task 1 of the router plan)
  const pageIds = ["page-map", "page-market", "page-technology", "page-demand-transport", "page-policy", "page-companies", "page-tools"];
  pageIds.forEach((id) => ok(!!doc.getElementById(id), `page section exists: ${id}`));
  ok(!doc.getElementById("page-map").hidden, "page-map visible by default");
  pageIds.slice(1).forEach((id) => ok(doc.getElementById(id).hidden, `${id} hidden by default`));
  ok(doc.querySelectorAll("#tab-nav .tab-btn").length === 7, "tab nav has 7 buttons");
  ok(!!doc.querySelector('.tab-btn[data-route="map"]') && doc.querySelector('.tab-btn[data-route="map"]').classList.contains("active"), "Map tab active by default");
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node js/smoke-test.js`
Expected: `FAIL  page section exists: page-map` (and the rest of the new assertions also FAIL — none of this HTML exists yet).

- [ ] **Step 3: Add the tab nav + open the page-map wrapper**

In `index.html`, find:

```html
<body>

<main id="map"></main>
```

Replace with:

```html
<body>

<!-- Persistent across all pages: switches between Map and the placeholder feature tabs -->
<nav class="glass" id="tab-nav">
  <button class="tab-btn active" data-route="map">🗺 Map</button>
  <button class="tab-btn" data-route="market">💹 Market &amp; Economics</button>
  <button class="tab-btn" data-route="technology">⚙ Technology</button>
  <button class="tab-btn" data-route="demand-transport">🚚 Demand &amp; Transport</button>
  <button class="tab-btn" data-route="policy">📜 Policy</button>
  <button class="tab-btn" data-route="companies">🤝 Companies &amp; Partners</button>
  <button class="tab-btn" data-route="tools">🧮 Tools</button>
</nav>

<section id="page-map" class="page">
<main id="map"></main>
```

- [ ] **Step 4: Close the page-map wrapper and add the 6 placeholder pages**

Find:

```html
<div id="attribution">Data: DOE · IEA Hydrogen Tracker · EIA · GEM · company sources — see citations · © OpenStreetMap © CARTO · Web lines are illustrative · Prototype</div>

<script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
```

Replace with:

```html
<div id="attribution">Data: DOE · IEA Hydrogen Tracker · EIA · GEM · company sources — see citations · © OpenStreetMap © CARTO · Web lines are illustrative · Prototype</div>
</section>

<section id="page-market" class="page" hidden>
  <div class="page-placeholder"><h2>Market &amp; Economics</h2><p>Coming soon.</p></div>
</section>

<section id="page-technology" class="page" hidden>
  <div class="page-placeholder"><h2>Technology</h2><p>Coming soon.</p></div>
</section>

<section id="page-demand-transport" class="page" hidden>
  <div class="page-placeholder"><h2>Demand &amp; Transport</h2><p>Coming soon.</p></div>
</section>

<section id="page-policy" class="page" hidden>
  <div class="page-placeholder"><h2>Policy</h2><p>Coming soon.</p></div>
</section>

<section id="page-companies" class="page" hidden>
  <div class="page-placeholder"><h2>Companies &amp; Partners</h2><p>Coming soon.</p></div>
</section>

<section id="page-tools" class="page" hidden>
  <div class="page-placeholder"><h2>Tools</h2><p>Coming soon.</p></div>
</section>

<script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"></script>
```

- [ ] **Step 5: Add CSS for the tab nav and placeholder pages**

In `style.css`, find:

```css
.maplibregl-ctrl-attrib { display: none !important; }
```

Replace with:

```css
.maplibregl-ctrl-attrib { display: none !important; }

/* ---------- Tab nav (persistent, sits below the header capsule row) ---------- */
#tab-nav {
  top: 60px; left: 50%; transform: translateX(-50%);
  display: flex; align-items: center; gap: 2px;
  padding: 4px 5px;
  border-radius: var(--r-md);
  max-width: calc(100vw - 28px);
  overflow-x: auto;
}
.tab-btn {
  font-size: 10.5px; font-weight: 500; letter-spacing: 0.02em;
  padding: 6px 11px;
  color: var(--text-muted);
  background: transparent;
  border: none; border-radius: 6px;
  cursor: pointer;
  transition: all 0.14s ease;
  white-space: nowrap;
}
.tab-btn.active {
  color: var(--text-hi);
  background: rgba(63, 214, 232, 0.13);
  box-shadow: inset 0 0 0 1px var(--line-accent);
}
.tab-btn:hover:not(.active) { color: var(--text); }
.tab-btn:focus-visible { outline: 1px solid var(--cyan); }

.page[hidden] { display: none; }
.page-placeholder {
  position: fixed; inset: 0;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-family: var(--font);
}
.page-placeholder h2 {
  font-family: var(--font-head); color: var(--text-hi); font-size: 20px; margin: 0;
}
.page-placeholder p { margin: 0; font-size: 13px; }
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `node js/smoke-test.js`
Expected: `ALL TESTS PASSED`, including all the new `page section exists`/`hidden by default`/`tab nav` assertions. (Task 2's router-behavior assertions don't exist yet — they're added in Task 2 Step 1 — so this run only needs to satisfy what Task 1 added on top of everything that already passed before.)

- [ ] **Step 7: Commit**

```bash
git add index.html style.css js/smoke-test.js
git commit -m "feat: add tab nav and page section structure for multi-tab shell"
```

---

## Task 2: Router behavior

**Files:**
- Create: `js/09-router.js`
- Modify: `index.html` (one script tag)
- Modify: `js/smoke-test.js`

**Interfaces:**
- Consumes: `map` (global, from `js/01-core.js`), DOM structure from Task 1 (`#tab-nav .tab-btn[data-route]`, `.page` sections with matching ids).
- Produces: `navigateTo(route)`, `wireTabNav()`, `currentRouteFromHash()`, `initRouter()` — no later task in this plan depends on these, but future feature-tab specs will define `initMarketPage()`/`initTechnologyPage()`/etc. globals that `navigateTo` calls automatically once defined (see Step 3 — the call is guarded by `typeof window[entry.init] === "function"`, so it's a no-op until those functions exist).

- [ ] **Step 1: Add the failing assertions to smoke-test.js first**

Find the line added in Task 1:

```js
  ok(!!doc.querySelector('.tab-btn[data-route="map"]') && doc.querySelector('.tab-btn[data-route="map"]').classList.contains("active"), "Map tab active by default");
```

Add immediately after it:

```js

  // Tab/router shell — router behavior (Task 2 of the router plan)
  click(doc.querySelector('.tab-btn[data-route="technology"]'));
  ok(window.location.hash === "#technology", "clicking a tab updates the URL hash");
  ok(!doc.getElementById("page-technology").hidden, "technology page shown after click");
  ok(doc.getElementById("page-map").hidden, "map page hidden after navigating away");
  ok(doc.querySelector('.tab-btn[data-route="technology"]').classList.contains("active"), "technology tab marked active");
  ok(!doc.querySelector('.tab-btn[data-route="map"]').classList.contains("active"), "map tab no longer active");

  window.location.hash = "#policy";
  window.dispatchEvent(new window.Event("hashchange"));
  ok(!doc.getElementById("page-policy").hidden, "direct hash navigation shows the policy page");
  ok(doc.getElementById("page-technology").hidden, "previous page hidden after hash navigation");

  window.location.hash = "#map";
  window.dispatchEvent(new window.Event("hashchange"));
  ok(!doc.getElementById("page-map").hidden, "navigating back to #map shows page-map again");
  ok(!!doc.getElementById("map"), "map container still present after returning to the Map tab");
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node js/smoke-test.js`
Expected: `FAIL  clicking a tab updates the URL hash` (and the rest of the new assertions also FAIL — clicking a `.tab-btn` does nothing yet, there's no router).

- [ ] **Step 3: Create js/09-router.js**

```js
/* ==========================================================================
   H2Grid · Tab router
   Hash-based routing between the Map page and the placeholder feature
   pages. Browser classic scripts share one global lexical scope, so map,
   helpers & state from core are visible here. Load order matters — see
   index.html (loads last: needs `map` from 01-core.js for the
   resize-on-return fix).
   ======================================================================= */

const ROUTES = {
  map: { page: "page-map", init: null },
  market: { page: "page-market", init: "initMarketPage" },
  technology: { page: "page-technology", init: "initTechnologyPage" },
  "demand-transport": { page: "page-demand-transport", init: "initDemandTransportPage" },
  policy: { page: "page-policy", init: "initPolicyPage" },
  companies: { page: "page-companies", init: "initCompaniesPage" },
  tools: { page: "page-tools", init: "initToolsPage" }
};
const loadedRoutes = {};

function currentRouteFromHash() {
  const h = location.hash.slice(1);
  return ROUTES.hasOwnProperty(h) ? h : "map";
}

function navigateTo(route) {
  if (!ROUTES.hasOwnProperty(route)) route = "map";
  const entry = ROUTES[route];
  Object.keys(ROUTES).forEach((r) => {
    const el = document.getElementById(ROUTES[r].page);
    if (el) el.hidden = r !== route;
  });
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.route === route);
  });
  if (entry.init && !loadedRoutes[route] && typeof window[entry.init] === "function") {
    window[entry.init]();
  }
  loadedRoutes[route] = true;
  if (route === "map" && typeof map !== "undefined" && map.resize) {
    requestAnimationFrame(() => map.resize());
  }
}

function wireTabNav() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const route = btn.dataset.route;
      if (location.hash.slice(1) !== route) location.hash = route;
      navigateTo(route);
    });
  });
}

window.addEventListener("hashchange", () => navigateTo(currentRouteFromHash()));

function initRouter() {
  wireTabNav();
  navigateTo(currentRouteFromHash());
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initRouter);
else initRouter();
```

- [ ] **Step 4: Add the script tag to index.html**

Find:

```html
<script src="js/08-analytics.js"></script>
</body>
```

Replace with:

```html
<script src="js/08-analytics.js"></script>
<script src="js/09-router.js"></script>
</body>
```

- [ ] **Step 5: Register the new module and add a resize stub in smoke-test.js**

Find:

```js
window.eval([
  "01-core.js", "02-layers.js", "03-filters.js", "04-search.js",
  "05-detail.js", "06-tour.js", "07-live.js", "iea-layer.js", "hud.js",
  "08-analytics.js"
].map(M).join("\n;\n"));
```

Replace with:

```js
window.eval([
  "01-core.js", "02-layers.js", "03-filters.js", "04-search.js",
  "05-detail.js", "06-tour.js", "07-live.js", "iea-layer.js", "hud.js",
  "08-analytics.js", "09-router.js"
].map(M).join("\n;\n"));
```

Find:

```js
  getCanvas() { return { style: {} }; }
}
```

Replace with:

```js
  getCanvas() { return { style: {} }; }
  resize() {}
}
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `node js/smoke-test.js`
Expected: `ALL TESTS PASSED`, including every new router assertion.

- [ ] **Step 7: Commit**

```bash
git add js/09-router.js index.html js/smoke-test.js
git commit -m "feat: add hash-based tab router"
```

---

## Post-implementation manual check

1. Start the dev server (`static-server` in `.claude/launch.json`, or `npx http-server -p 8000 -c-1`).
2. Open the app — confirm the globe renders exactly as before, Map tab is active in the new nav bar.
3. Click through all 7 tabs — confirm each placeholder page shows "Coming soon" and the globe/HUD panels are fully hidden while on a non-Map tab.
4. Click back to Map — confirm the globe re-renders correctly (not blank/broken — this is the `map.resize()` fix; if it fails, the canvas will show a partial or blank globe until the window is manually resized).
5. Use the browser's back/forward buttons after clicking a few tabs — confirm they navigate correctly.
6. Load the page directly at `http://localhost:8000/#technology` — confirm it lands on the Technology tab, not Map.
7. Confirm existing Map-tab features still work unchanged: search, layer dock toggles, status/region filters, legend, tour, Analytics panel, Markets panel, facility detail card.
