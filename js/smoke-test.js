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
class StubMap {
  constructor(opts) {
    (((opts || {}).style || {}).layers || []).forEach((l) => {
      layers[l.id] = { ...l, visibility: (l.layout && l.layout.visibility) || "visible" };
    });
    setTimeout(() => (handlers["load"] || []).forEach((h) => h()), 0);
  }
  on(ev, a, b) { const key = b ? ev + ":" + a : ev; (handlers[key] = handlers[key] || []).push(b || a); }
  addControl() {}
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
}
class StubPopup {
  setLngLat() { return this; } setHTML() { return this; } addTo() { return this; } remove() { return this; }
}
window.maplibregl = { Map: StubMap, NavigationControl: class {}, AttributionControl: class {}, Popup: StubPopup };
window.requestAnimationFrame = () => 0;
const fetchCalls = [];
window.fetch = (url) => { fetchCalls.push(String(url)); return Promise.reject(new Error("offline test")); };

const M = (f) => fs.readFileSync(path.join(__dirname, f), "utf8");
window.eval(M("data.js"));
window.eval(M("iea-data.js"));
window.eval(M("news-data.js"));
// modules are classic scripts sharing one global scope in the browser; eval
// does not, so concatenate them here in index.html load order.
window.eval([
  "01-core.js", "02-layers.js", "03-filters.js", "04-search.js",
  "05-detail.js", "06-tour.js", "07-live.js", "iea-layer.js", "hud.js",
  "08-analytics.js"
].map(M).join("\n;\n"));

setTimeout(() => {
  const doc = window.document;
  const click = (el) => el.dispatchEvent(new window.Event("click", { bubbles: true }));

  ["basemap-dark", "upstream", "production", "manufacturing", "storage", "endUse",
   "fuelingStations", "pipelines", "hubs", "hub-labels", "flows-base", "web",
   "selection-ring", "iea-clusters", "iea-cluster-count", "iea-points"]
    .forEach((id) => ok(!!layers[id], `layer exists: ${id}`));

  // IEA tier
  const M = window.IEA_META, I = window.IEA_DATA;
  ok(I.features.length === M.count && M.count > 3000, `IEA tier loaded (${M.count} records)`);
  ok(I.features.every((f) => Math.abs(f.geometry.coordinates[0]) <= 180 && Math.abs(f.geometry.coordinates[1]) <= 90), "all IEA coords valid");
  ok(!!doc.getElementById("stat-iea"), "announced counter present in HUD");

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

  // HUD: boot overlay
  ok(!!doc.getElementById("boot"), "JARVIS boot overlay rendered");
  ok(doc.querySelector(".boot-line").textContent.includes("H₂GRID OS"), "boot shows OS title");

  // v7: single console theme — no light mode, no toggle
  ok(!doc.getElementById("theme-btn"), "theme toggle removed");
  ok(!doc.body.classList.contains("light"), "console stays dark");
  ok(layers["basemap-dark"].visibility === "visible", "dark basemap active");

  // Search + detail with decode effect patched in
  const box = doc.getElementById("search-box");
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

  // Tour still 10 stops
  click(doc.getElementById("tour-btn"));
  for (let i = 0; i < 9; i++) click(doc.getElementById("tour-next"));
  ok(doc.getElementById("tour-step-label").textContent === "10 / 10", "tour reaches 10/10");
  click(doc.getElementById("tour-next"));

  ok((window.HYDROGEN_DATA.ieaGlobal.facts || []).length >= 8, "intel ticker facts present");

  // Analytics panel (Network / Intel)
  const analyticsBtn = doc.getElementById("analytics-btn");
  const analyticsPanel = doc.getElementById("analytics-panel");
  ok(!!analyticsBtn && !!analyticsPanel, "analytics toggle + panel present");
  ok(!!analyticsPanel && analyticsPanel.hidden, "analytics panel starts hidden");
  if (analyticsBtn) click(analyticsBtn);
  ok(!!analyticsPanel && !analyticsPanel.hidden && analyticsBtn.classList.contains("active"), "analytics panel opens on click");
  ok(doc.querySelectorAll("#analytics-network .bar-row").length === 7, "network bars render all 7 taxonomy tiers");
  const networkTotal = Array.from(doc.querySelectorAll("#analytics-network .bar-count")).reduce((s, el) => s + Number(el.textContent), 0);
  ok(networkTotal > 0, "network bars show nonzero total count");
  click(doc.querySelector('#status-seg .seg-btn[data-status="operating"]'));
  const networkFiltered = Array.from(doc.querySelectorAll("#analytics-network .bar-count")).reduce((s, el) => s + Number(el.textContent), 0);
  ok(networkFiltered <= networkTotal, "network bars recompute on status filter change");
  click(doc.querySelector('#status-seg .seg-btn[data-status="all"]'));
  const networkRestored = Array.from(doc.querySelectorAll("#analytics-network .bar-count")).reduce((s, el) => s + Number(el.textContent), 0);
  ok(networkRestored === networkTotal, "network bars restore full total when filter cleared");
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
    console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} FAILURES`);
    process.exit(failures === 0 ? 0 : 1);
  }, 60);
}, 60);
