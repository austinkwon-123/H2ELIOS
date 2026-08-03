// Headless smoke test for H₂Grid v6 (run: node smoke-test.js, needs jsdom in /tmp).
// v5 suite + IEA announced tier + JARVIS HUD checks.
const fs = require("fs");
const path = require("path");
const { JSDOM } = require(path.join("/tmp", "node_modules", "jsdom"));

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost/", pretendToBeVisual: true });
const { window } = dom;

let failures = 0;
const ok = (cond, msg) => { console.log((cond ? "PASS" : "FAIL") + "  " + msg); if (!cond) failures++; };

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
  addSource(id, def) { sources[id] = { def, setData(d) { this.data = d; } }; }
  getSource(id) { return sources[id]; }
  addLayer(l) { layers[l.id] = { ...l, visibility: (l.layout && l.layout.visibility) || "visible" }; }
  getLayer(id) { return layers[id]; }
  setLayoutProperty(id, k, v) { if (k === "visibility") layers[id].visibility = v; }
  setPaintProperty(id, k, v) { layers[id].paint = layers[id].paint || {}; layers[id].paint[k] = v; }
  setFilter(id, f) { layers[id].filter = f; }
  flyTo(o) { this.lastFly = o; }
  easeTo(o) { this.lastEase = o; }
  getZoom() { return 1.7; }
  getCenter() { return { lng: 15, lat: 20 }; }
  setSky(s) { this.sky = s; }
  getCanvas() { return { style: {} }; }
  resize() {}
}
class StubPopup {
  setLngLat() { return this; } setHTML() { return this; } addTo() { return this; } remove() { return this; }
}
window.maplibregl = { Map: StubMap, NavigationControl: class {}, AttributionControl: class {}, Popup: StubPopup };
window.requestAnimationFrame = () => 0;
const fetchCalls = [];
window.fetch = (url) => { fetchCalls.push(String(url)); return Promise.reject(new Error("offline test")); };

window.Chart = class {
  constructor(ctx, config) {
    this.ctx = ctx;
    this.config = config;
  }
  destroy() {}
};

const M = (f) => fs.readFileSync(path.join(__dirname, f), "utf8");
window.eval(M("data.js"));
window.eval(M("iea-data.js"));
window.eval(M("eu-stations-data.js"));
window.eval(M("breakeven-data.js"));
window.eval(M("news-data.js"));
// modules are classic scripts sharing one global scope in the browser; eval
// does not, so concatenate them here in index.html load order.
window.eval([
  "01-core.js", "02-layers.js", "03-filters.js", "04-search.js",
  "05-detail.js", "07-live.js", "iea-layer.js", "hud.js",
  "08-analytics.js", "09-router.js", "10-calculator.js",
  "11-market.js", "12-technology.js", "13-demand-transport.js",
  "14-policy.js", "15-companies.js", "16-ai-features.js",
  "17-visualization.js"
].map(M).join("\n;\n") + `
  window.localStorage.setItem("h2grid_ai_cache_overview_apac", JSON.stringify({
    prompt: "System Prompt: You are H2Grid AI...",
    analysis: "In the APAC region..."
  }));
`);

setTimeout(() => {
  const doc = window.document;
  const click = (el) => el.dispatchEvent(new window.Event("click", { bubbles: true }));

  ["basemap-dark", "upstream", "production", "manufacturing", "storage", "endUse",
   "fuelingStations", "pipelines", "hubs", "hub-labels", "flows-base", "web",
   "selection-ring", "iea-clusters", "iea-cluster-count", "iea-points"]
    .forEach((id) => ok(!!layers[id], `layer exists: ${id}`));

  // Reset View map control (Task 5 of the ui-overlay-enhancements plan)
  const resetBtn = doc.querySelector('[aria-label="Reset view"]');
  ok(!!resetBtn, "Reset view button rendered");
  ok(!!resetBtn && resetBtn.closest(".maplibregl-ctrl-group") !== null, "Reset view button uses maplibregl-ctrl-group chrome");
  if (resetBtn) click(resetBtn);
  ok(!!mapInstance.lastFly, "Reset view button calls map.flyTo");
  ok(!!mapInstance.lastFly && mapInstance.lastFly.center[0] === 15 && mapInstance.lastFly.center[1] === 20, "Reset view flies back to the initial center [15,20]");
  ok(!!mapInstance.lastFly && mapInstance.lastFly.zoom === 1.7 && mapInstance.lastFly.pitch === 58 && mapInstance.lastFly.bearing === 12, "Reset view restores the initial zoom/pitch/bearing");

  // Sidebar tooltips (Task 2 of the ui-overlay-enhancements plan)
  const dockBtns = doc.querySelectorAll("#layer-dock .dock-btn");
  ok(dockBtns.length === 13, `layer dock has 13 buttons (found ${dockBtns.length})`);
  ok(Array.from(dockBtns).every((b) => b.classList.contains("has-tip") && b.classList.contains("tip-right")), "every dock button has the shared tooltip classes");
  ok(Array.from(dockBtns).every((b) => !!b.getAttribute("aria-label") && b.getAttribute("aria-label") === b.getAttribute("data-tip")), "every dock button's aria-label matches its data-tip");
  ok(Array.from(dockBtns).every((b) => !b.hasAttribute("title")), "no dock button still has a native title attribute (would double up with the custom tooltip)");

  // IEA tier
  const M = window.IEA_META, I = window.IEA_DATA;
  ok(I.features.length === M.count && M.count > 3000, `IEA tier loaded (${M.count} records)`);
  ok(I.features.every((f) => Math.abs(f.geometry.coordinates[0]) <= 180 && Math.abs(f.geometry.coordinates[1]) <= 90), "all IEA coords valid");
  const ieaBtn = doc.querySelector('.dock-btn[data-layer="iea"]');
  ok(!!ieaBtn, "IEA dock button exists");
  click(ieaBtn);
  ok(layers["iea-clusters"].visibility === "none" && layers["iea-points"].visibility === "none", "dock toggle hides IEA tier");
  click(ieaBtn);
  ok(layers["iea-clusters"].visibility === "visible", "dock toggle shows IEA tier");

  // Filter chain rebuilds the clustered source
  click(doc.querySelector('#status-seg .seg-btn[data-status="atrisk"]'));
  const filtered = sources["iea"].data.features;
  ok(filtered.length > 100 && filtered.length < M.count, `status filter rebuilds IEA source (${filtered.length} at-risk)`);
  ok(filtered.every((f) => f.properties.statusClass === "atrisk"), "IEA filter correctness");
  click(doc.querySelector('#status-seg .seg-btn[data-status="all"]'));
  ok(sources["iea"].data.features.length === M.count, "IEA source restored on All");

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

  // HUD: boot overlay
  ok(!!doc.getElementById("boot"), "JARVIS boot overlay rendered");
  ok(doc.querySelector(".boot-line").textContent.includes("H2ELIOS"), "boot shows product title");

  // v7: single console theme — no light mode, no toggle
  ok(!doc.getElementById("theme-btn"), "theme toggle removed");
  ok(!doc.body.classList.contains("light"), "console stays dark");
  ok(layers["basemap-dark"].visibility === "visible", "dark basemap active");

  // Search + detail with decode effect patched in
  const box = doc.getElementById("network-search");
  const results = doc.getElementById("search-results");
  box.focus();
  box.value = "kobe";
  box.dispatchEvent(new window.Event("input", { bubbles: true }));
  click(results.querySelector(".fac-item"));
  ok(!doc.getElementById("detail-card").hidden, "detail sheet opens (patched selectFacility)");
  ok(doc.querySelector(".detail-name").textContent.includes("Kobe"), "detail name intact before decode ticks");
  ok(doc.querySelectorAll(".stat-cell").length === 6, "project statistics grid has 6 cells");
  ok(doc.querySelector(".stats-grid").textContent.includes("H₂/yr") || doc.querySelector(".stats-grid").textContent.includes("Not disclosed"), "annual output derived or placeholder");
  ok(doc.body.textContent.includes("RELATIONSHIPS"), "relationship summary present");
  ok(doc.querySelectorAll(".rel-row").length === 3, "3 relationship rows");
  click(doc.getElementById("detail-close"));

  ok(!doc.getElementById("tour-btn"), "old project-narration Tour removed (superseded by Demo)");

  ok((window.HYDROGEN_DATA.ieaGlobal.facts || []).length >= 8, "intel ticker facts present");

  // Analytics panel (Network / Intel)
  const analyticsBtn = doc.getElementById("analytics-btn");
  const analyticsPanel = doc.getElementById("analytics-panel");
  ok(!!analyticsBtn && !!analyticsPanel, "analytics toggle + panel present");
  ok(!!analyticsPanel && analyticsPanel.hidden, "analytics panel starts hidden");
  if (analyticsBtn) click(analyticsBtn);
  ok(!!analyticsPanel && !analyticsPanel.hidden && analyticsBtn.classList.contains("active"), "analytics panel opens on click");
  ok(doc.querySelectorAll("#analytics-news .news-card").length === (window.HYDROGEN_NEWS || []).length && (window.HYDROGEN_NEWS || []).length > 0, "news cards render from HYDROGEN_NEWS");
  ok(Array.from(doc.querySelectorAll("#analytics-news .news-card")).every((el) => el.tagName === "A"), "all sample news cards render as real links (all sample URLs are https)");
  click(analyticsBtn);
  ok(!!analyticsPanel && analyticsPanel.hidden && !analyticsBtn.classList.contains("active"), "analytics panel closes on second click");

  // Markets panel — separate toggle/panel from Analytics (wider, bottom-docked)
  const marketsBtn = doc.getElementById("markets-btn");
  const marketsPanel = doc.getElementById("markets-panel");
  ok(!!marketsBtn && !!marketsPanel, "markets toggle + panel present");
  ok(!!marketsPanel && marketsPanel.hidden, "markets panel starts hidden");
  if (marketsBtn) click(marketsBtn);
  ok(!!marketsPanel && !marketsPanel.hidden && marketsBtn.classList.contains("active"), "markets panel opens on click");

  setTimeout(() => {
    // renderMarkets() is async once a real key is configured (it awaits a
    // fetch), so its fallback/row DOM only lands after this delay — unlike
    // the synchronous no-key early-return, checking it right after the
    // click (as the earlier assertions do) would race the promise chain.
    // jsdom's window.eval doesn't share const/let bindings across separate
    // eval calls (verified empirically), so FINNHUB_KEY can't be read back
    // directly here — the two renderMarkets() branches render distinct
    // copy, so use that as the observable signal instead.
    const marketsFallbackEl = doc.querySelector("#analytics-markets .markets-fallback");
    ok(!!marketsFallbackEl, "markets shows fallback state (no key configured, or the fetch failed)");
    const finnhubCalled = fetchCalls.some((u) => u.includes("finnhub.io"));
    const noKeyBranch = !!marketsFallbackEl && marketsFallbackEl.textContent.includes("Configure a free Finnhub API key");
    if (noKeyBranch) {
      ok(!finnhubCalled, "markets never calls the Finnhub API when FINNHUB_KEY is empty");
    } else {
      ok(finnhubCalled, "markets calls the Finnhub API when FINNHUB_KEY is configured");
    }
    if (marketsBtn) click(marketsBtn);
    ok(!!marketsPanel && marketsPanel.hidden && !marketsBtn.classList.contains("active"), "markets panel closes on second click");
    ok(doc.getElementById("api-status").className.includes("fallback"), "AFDC failure -> fallback pill");

  // Tab/router shell — page structure (Task 1 of the router plan)
  const pageIds = ["page-map", "page-market", "page-technology", "page-demand-transport", "page-policy", "page-companies", "page-tools", "page-timeline"];
  pageIds.forEach((id) => ok(!!doc.getElementById(id), `page section exists: ${id}`));
  ok(!doc.getElementById("page-map").hidden, "page-map visible by default");
  pageIds.slice(1).forEach((id) => ok(doc.getElementById(id).hidden, `${id} hidden by default`));
  ok(doc.querySelectorAll("#tab-nav .tab-btn").length === 8, "tab nav has 8 buttons");
  ok(!!doc.querySelector('.tab-btn[data-route="map"]') && doc.querySelector('.tab-btn[data-route="map"]').classList.contains("active"), "Map tab active by default");

  // Icon-only nav island (Task 7 of the ui-overlay-enhancements plan)
  const tabBtns = doc.querySelectorAll("#tab-nav .tab-btn");
  ok(Array.from(tabBtns).every((b) => b.classList.contains("has-tip") && b.classList.contains("tip-bottom")), "every tab button has the shared tooltip classes");
  ok(Array.from(tabBtns).every((b) => !!b.getAttribute("aria-label") && b.getAttribute("aria-label") === b.getAttribute("data-tip")), "every tab button's aria-label matches its data-tip");

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

  // Hydrogen calculator (Tools tab) — Task 1: shell + Unit Conversion + Efficiency
  click(doc.querySelector('.tab-btn[data-route="tools"]'));
  ok(!doc.getElementById("page-tools").hidden, "tools page shown after clicking Tools tab");
  ok(doc.querySelectorAll(".calc-tab").length === 5, "calculator has 5 sub-tabs");
  ok(doc.querySelector('.calc-tab[data-calc="unit"]').classList.contains("active"), "Unit Conversion sub-tab active by default");
  ok(!doc.getElementById("calc-unit").hidden, "Unit Conversion panel visible by default");
  ok(doc.getElementById("calc-efficiency").hidden, "Efficiency panel hidden by default");

  ok(doc.getElementById("uc-out-kg").textContent === "1.0000", "unit conversion: 1 kg default renders 1.0000 kg");
  ok(doc.getElementById("uc-out-kwh_lhv").textContent === "33.33", "unit conversion: 1 kg = 33.33 kWh (LHV)");
  const ucValue = doc.getElementById("uc-value");
  ucValue.value = "";
  ucValue.dispatchEvent(new window.Event("input", { bubbles: true }));
  ok(doc.getElementById("uc-out-kg").textContent === "—", "unit conversion: empty input renders — not NaN");
  ucValue.value = "1";
  ucValue.dispatchEvent(new window.Event("input", { bubbles: true }));

  click(doc.querySelector('.calc-tab[data-calc="efficiency"]'));
  ok(doc.querySelector('.calc-tab[data-calc="efficiency"]').classList.contains("active"), "Efficiency sub-tab becomes active on click");
  ok(!doc.getElementById("calc-efficiency").hidden, "Efficiency panel shown after click");
  ok(doc.getElementById("calc-unit").hidden, "Unit Conversion panel hidden after switching tabs");
  ok(doc.getElementById("eff-out-lhv").textContent === "60.6", "efficiency: 55 kWh/kg default renders 60.6% vs LHV");
  ok(doc.getElementById("eff-out-hhv").textContent === "71.6", "efficiency: 55 kWh/kg default renders 71.6% vs HHV");
  const effSec = doc.getElementById("eff-sec");
  effSec.value = "0";
  effSec.dispatchEvent(new window.Event("input", { bubbles: true }));
  ok(doc.getElementById("eff-out-lhv").textContent === "—", "efficiency: zero input renders — not Infinity");
  effSec.value = "55";
  effSec.dispatchEvent(new window.Event("input", { bubbles: true }));

  // Hydrogen calculator — Task 2: CAPEX/OPEX, LCOH, Current Density
  click(doc.querySelector('.calc-tab[data-calc="capex"]'));
  ok(!doc.getElementById("calc-capex").hidden, "CAPEX/OPEX panel shown after click");
  ok(doc.getElementById("co-out-total").textContent === "12000000.00", "capex/opex: defaults render total CAPEX 12000000.00");
  const coRate = doc.getElementById("co-rate");
  coRate.value = "0";
  coRate.dispatchEvent(new window.Event("input", { bubbles: true }));
  ok(doc.getElementById("co-out-annCapex").textContent === "600000.00", "capex/opex: 0% discount rate gives annualized CAPEX = total/lifetime = 600000.00");
  const coLife = doc.getElementById("co-life");
  coLife.value = "0";
  coLife.dispatchEvent(new window.Event("input", { bubbles: true }));
  ok(doc.getElementById("co-out-annCapex").textContent === "—", "capex/opex: zero lifetime renders — not Infinity/NaN");
  ok(doc.getElementById("co-out-total").textContent === "12000000.00", "capex/opex: total CAPEX unaffected by lifetime (independent calc)");
  coLife.value = "20";
  coLife.dispatchEvent(new window.Event("input", { bubbles: true }));
  coRate.value = "8";
  coRate.dispatchEvent(new window.Event("input", { bubbles: true }));

  click(doc.querySelector('.calc-tab[data-calc="lcoh"]'));
  ok(!doc.getElementById("calc-lcoh").hidden, "LCOH panel shown after click");
  ok(doc.getElementById("lc-out-prod").textContent !== "—", "lcoh: defaults render a finite annual production figure");
  ok(doc.getElementById("lc-out-lcoh").textContent !== "—", "lcoh: defaults render a finite LCOH figure");
  const lcSec = doc.getElementById("lc-sec");
  lcSec.value = "0";
  lcSec.dispatchEvent(new window.Event("input", { bubbles: true }));
  ok(doc.getElementById("lc-out-prod").textContent === "—", "lcoh: zero specific energy consumption renders — not Infinity");
  ok(doc.getElementById("lc-out-lcoh").textContent === "—", "lcoh: LCOH also — when production is undefined");
  lcSec.value = "55";
  lcSec.dispatchEvent(new window.Event("input", { bubbles: true }));

  click(doc.querySelector('.calc-tab[data-calc="density"]'));
  ok(!doc.getElementById("calc-density").hidden, "Current Density panel shown after click");
  ok(doc.getElementById("cd-out-density").textContent === "0.667", "current density: 200A / 300cm2 defaults render 0.667 A/cm2");
  ok(doc.getElementById("cd-out-stack").textContent === "18.00", "current density: 50 cells * 1.8V * 200A / 1000 renders 18.00 kW stack power");
  const cdArea = doc.getElementById("cd-area");
  cdArea.value = "0";
  cdArea.dispatchEvent(new window.Event("input", { bubbles: true }));
  ok(doc.getElementById("cd-out-density").textContent === "—", "current density: zero area renders — not Infinity");
  ok(doc.getElementById("cd-out-stack").textContent === "18.00", "current density: stack power unaffected by area (independent calc)");

  // Market Page Assertions
  click(doc.querySelector('.tab-btn[data-route="market"]'));
  ok(!doc.getElementById("page-market").hidden, "market page shown after clicking Market tab");
  ok(doc.getElementById("m-kpi-funding").textContent !== "—", "market page loads committed funding KPI");
  ok(doc.getElementById("lcoh-chart") !== null, "LCOH chart container exists");
  ok(doc.getElementById("calc-power-price") !== null, "LCOH sensitivity power price slider exists");
  ok(doc.getElementById("sandbox-lcoh-val") !== null, "LCOH sensitivity simulated cost KPI exists");
  ok(doc.getElementById("vc-table-body").children.length > 0, "hydrogen deal registry lists items");

  // Technology Page Assertions
  click(doc.querySelector('.tab-btn[data-route="technology"]'));
  ok(!doc.getElementById("page-technology").hidden, "technology page shown after clicking Tech tab");
  ok(doc.querySelectorAll(".trl-node").length === 4, "technology page TRL maturity spectrum plots 4 technologies");
  ok(doc.getElementById("metals-chart") !== null, "critical materials price chart canvas exists");
  ok(doc.getElementById("calc-iridium-price") !== null, "iridium price shock simulator slider exists");
  ok(doc.getElementById("sandbox-catalyst-val") !== null, "simulated precious metals catalyst component cost KPI exists");

  // Demand & Transport Page Assertions
  click(doc.querySelector('.tab-btn[data-route="demand-transport"]'));
  ok(!doc.getElementById("page-demand-transport").hidden, "demand & transport page shown after clicking tab");
  ok(doc.getElementById("enduse-chart") !== null, "end-use capacity share chart canvas exists");
  ok(doc.getElementById("transport-chart") !== null, "transport supply/demand trendline canvas exists");
  ok(doc.getElementById("calc-trans-dist") !== null, "transport distance slider simulator exists");
  ok(doc.getElementById("sim-lh2-vol") !== null, "liquid hydrogen simulated volume column exists");
  ok(doc.getElementById("sim-boiloff-val") !== null, "cryogenic boil-off output indicator exists");
  ok(doc.querySelectorAll(".offtaker-race-row").length === 4, "offtaker parity race lists 4 ranked sector bars");

  // Policy Page Assertions
  click(doc.querySelector('.tab-btn[data-route="policy"]'));
  ok(!doc.getElementById("page-policy").hidden, "policy page shown after clicking Policy tab");
  ok(doc.getElementById("policy-list-container").children.length > 0, "policy timeline displays updates");

  // Companies Page Assertions
  click(doc.querySelector('.tab-btn[data-route="companies"]'));
  ok(!doc.getElementById("page-companies").hidden, "companies page shown after clicking Companies tab");
  ok(doc.getElementById("companies-table-body").children.length > 0, "companies database lists entries");
  ok(doc.getElementById("partner-list-container").children.length > 0, "localized partner coordinator recommendations active");

  // AI features map integration
  click(doc.querySelector('.tab-btn[data-route="map"]'));
  click(doc.querySelector('#region-seg .seg-btn[data-region="apac"]'));
  ok(!doc.getElementById("regional-ai-panel").hidden, "regional AI panel appears when a region is selected on map");
  ok(doc.getElementById("regional-ai-prompt").textContent !== "—", "regional AI panel populates custom model prompt");
  
  // AI project detail injection (clear region filter first so Stegra is searchable)
  click(doc.querySelector('#region-seg .seg-btn[data-region="all"]'));
  const searchBox = doc.getElementById("network-search");
  searchBox.focus();
  searchBox.value = "Stegra";
  searchBox.dispatchEvent(new window.Event("input", { bubbles: true }));
  click(doc.getElementById("search-results").querySelector(".fac-item"));
  ok(doc.querySelector(".detail-ai-text") !== null, "detail panel injects AI Project Engagement Analysis");

  // Search moves into the ribbon; results-dropdown clip fix (Task 3 of the map-layout-reorganization plan)
  ok(doc.getElementById("ribbon-zone-c").contains(doc.getElementById("search-capsule")), "#search-capsule now lives inside #ribbon-zone-c");
  ok(!doc.getElementById("search-capsule").contains(doc.getElementById("search-results")), "#search-results is no longer a descendant of #search-capsule (was clipped by its overflow:hidden)");

  // Shared right-panel CSS slot (Task 1 of the right-panel-manager plan)
  ["detail-card", "regional-ai-panel", "markets-panel"].forEach((id) => {
    const el = doc.getElementById(id);
    ok(el.classList.contains("right-panel-slot"), `#${id} carries the shared .right-panel-slot class`);
  });

  // Extracted close functions (Task 2 of the right-panel-manager plan)
  ok(typeof window.closeDetailPanel === "function", "closeDetailPanel() is defined");
  ok(typeof window.closeRegionalAIPanel === "function", "closeRegionalAIPanel() is defined");
  ok(typeof window.closeMarketsPanel === "function", "closeMarketsPanel() is defined");

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

  // Advanced Visualizations: Temporal Sandbox Dashboard & 3D Extrusion
  click(doc.querySelector('.tab-btn[data-route="timeline"]'));
  ok(!doc.getElementById("page-timeline").hidden, "temporal sandbox page shown after clicking tab");
  ok(doc.getElementById("sandbox-slider") !== null, "sandbox timeline year range slider exists");
  ok(doc.getElementById("sandbox-capacity-chart") !== null, "sandbox capacity projection chart canvas exists");
  ok(doc.getElementById("sandbox-project-list") !== null, "sandbox pipeline rollout list container exists");

  click(doc.querySelector('.tab-btn[data-route="map"]'));
  ok(doc.getElementById("dock-3d-btn") !== null, "3D toggle button injected in layer dock");
  
  const d3d = doc.getElementById("dock-3d-btn");
  click(d3d);
  ok(window.is3DActive === true, "clicking 3D button activates volumetric extrusion mode");
  click(d3d);
  ok(window.is3DActive === false, "clicking 3D button again deactivates volumetric extrusion mode");

  console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
  }, 100);
}, 100);
