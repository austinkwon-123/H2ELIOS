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
  tools: { page: "page-tools", init: "initToolsPage" },
  timeline: { page: "page-timeline", init: "initTimelinePage" }
};
if (window.H2G_CONFIG?.ENABLE_PROTOTYPE_WORKSPACES) {
  ROUTES.companies = { page: "page-companies", init: "initCompaniesPage" };
}
const loadedRoutes = {};
const routeCleanupCallbacks = new Map();

function registerRouteCleanup(route, callback) {
  if (!ROUTES[route] || typeof callback !== "function") return function noop() {};
  if (!routeCleanupCallbacks.has(route)) routeCleanupCallbacks.set(route, new Set());
  routeCleanupCallbacks.get(route).add(callback);
  return () => routeCleanupCallbacks.get(route)?.delete(callback);
}
window.registerRouteCleanup = registerRouteCleanup;

function runRouteCleanup(route) {
  const callbacks = routeCleanupCallbacks.get(route);
  if (!callbacks) return;
  callbacks.forEach((callback) => {
    try { callback(); } catch (error) { console.error(`Router cleanup failed for ${route}`, error); }
  });
}

function currentRouteFromHash() {
  // Routes are written into the hash as "#/policy". slice(1) left "/policy",
  // which matched no ROUTES key, so every deep link and every hashchange fell
  // through to the map — while the shell, which strips the slash in
  // currentWorkspaceRoute(), simultaneously showed the correct workspace
  // title. That split is why the bug read as "the chrome is right but the
  // page is wrong" rather than as a routing failure.
  const h = location.hash.replace(/^#?\/?/, "");
  return ROUTES.hasOwnProperty(h) ? h : "map";
}

// Must match .page-fade-out's own transition-duration in style.css — the
// swap is deferred by exactly as long as the fade-out CSS takes, so the
// outgoing workspace is actually gone (not just mid-fade) before the
// incoming one starts building/appearing.
const WORKSPACE_FADE_OUT_MS = 160;

function swapPagesInstant(route) {
  Object.keys(ROUTES).forEach((r) => {
    const el = document.getElementById(ROUTES[r].page);
    if (el) el.hidden = r !== route;
  });
}

function navigateTo(route) {
  if (!ROUTES.hasOwnProperty(route)) route = "map";
  if (window.H2Store?.getState().route !== route) {
    window.H2Store?.dispatch({ type: "ROUTE_CHANGE", payload: { route } });
  }
  const entry = ROUTES[route];
  const incomingEl = document.getElementById(entry.page);
  const outgoingRoute = Object.keys(ROUTES).find((r) => {
    const el = document.getElementById(ROUTES[r].page);
    return el && !el.hidden && r !== route;
  });
  const outgoingEl = outgoingRoute ? document.getElementById(ROUTES[outgoingRoute].page) : null;
  if (outgoingRoute) runRouteCleanup(outgoingRoute);

  const finishNav = () => {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.route === route);
    });
    positionActiveIndicatorSettled();
    if (entry.init && !loadedRoutes[route]) {
      if (typeof window[entry.init] === "function") {
        window[entry.init]();
        loadedRoutes[route] = true;
      } else {
        console.warn(`Router: ${entry.init}() not defined yet for route "${route}"`);
      }
    }
    if (typeof applyAnalyticalProvenance === "function") applyAnalyticalProvenance(incomingEl);
    // Handoff state is dispatched while the originating route is still in
    // the hash, so its store subscriber initially keeps the Return control
    // hidden. Re-evaluate visibility after every route swap, once the hash
    // and visible page agree.
    renderHandoffReturn(window.H2Store?.getState().handoff);
    if (route === "map" && typeof map !== "undefined" && map.resize) {
      requestAnimationFrame(() => map.resize());
    }
  };

  // No real outgoing workspace (first load, or same route) — swap
  // instantly, nothing to dissolve.
  if (!outgoingEl || outgoingEl === incomingEl) {
    swapPagesInstant(route);
    finishNav();
    return;
  }

  // Sequential crossfade: outgoing dissolves, THEN incoming builds and
  // fades in. A true simultaneous cross-dissolve would need every .page
  // fixed-positioned to overlap safely mid-transition, which isn't worth
  // risking against this app's already-tuned per-page scroll/height rules
  // for the same visual read — two consecutive ~halves inside the brief's
  // 320-450ms "workspace transition" window instead of one blended fade.
  outgoingEl.classList.add("page-fade-out");
  setTimeout(() => {
    if (incomingEl) incomingEl.classList.add("page-fade-in");
    swapPagesInstant(route);
    outgoingEl.classList.remove("page-fade-out");
    finishNav();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (incomingEl) incomingEl.classList.remove("page-fade-in");
    }));
  }, WORKSPACE_FADE_OUT_MS);
}

function currentMapCamera() {
  if (typeof map === "undefined" || !map?.getCenter) return window.H2Store?.getState().map.camera;
  const center = map.getCenter();
  return {
    center: [center.lng, center.lat],
    zoom: map.getZoom(),
    pitch: map.getPitch(),
    bearing: map.getBearing()
  };
}

function beginMapHandoff(options) {
  const source = options || {};
  const fromRoute = source.fromRoute || currentRouteFromHash();
  const props = source.props || source.selection?.props || source.project || null;
  const lngLat = source.lngLat || source.selection?.lngLat || source.coordinates || null;
  const originFilters = { ...(window.H2Store?.getState().filters || {}) };
  window.H2Store?.dispatch({
    type: "HANDOFF_BEGIN",
    payload: {
      fromRoute,
      label: source.label || (ROUTES[fromRoute] ? document.querySelector(`.tab-btn[data-route="${fromRoute}"] span`)?.textContent : "Previous workspace"),
      selectionId: source.selectionId || props?.id || props?.name || null,
      filters: originFilters,
      camera: currentMapCamera()
    }
  });
  if (props) window.H2Store?.dispatch({ type: "PROJECT_SELECT", payload: { props, lngLat } });
  if (source.year != null) window.H2Store?.dispatch({ type: "TIMELINE_YEAR_UPDATE", payload: { year: source.year } });
  if (source.filters) window.H2Store?.dispatch({ type: "FILTER_UPDATE", payload: { filters: source.filters } });

  location.hash = "map";
  navigateTo("map");
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (source.year != null && typeof applyTimelineFilter === "function") applyTimelineFilter();
    if (typeof applyFilters === "function") applyFilters();
    if (props && Array.isArray(lngLat)) {
      if (typeof map !== "undefined" && map?.flyTo) {
        map.flyTo({ center: lngLat, zoom: Math.max(map.getZoom?.() || 0, 5.4), duration: 900, essential: true });
      }
      if (typeof selectFacility === "function") selectFacility(props, lngLat);
    }
  }));
}
window.beginMapHandoff = beginMapHandoff;

function returnFromMapHandoff() {
  const handoff = window.H2Store?.getState().handoff;
  if (!handoff) return;
  window.H2Store.dispatch({ type: "HANDOFF_RETURN" });
  location.hash = handoff.fromRoute;
  navigateTo(handoff.fromRoute);
}
window.returnFromMapHandoff = returnFromMapHandoff;

function renderHandoffReturn(handoff) {
  const button = document.getElementById("handoff-return");
  if (!button) return;
  button.hidden = !handoff || currentRouteFromHash() !== "map";
  if (handoff) button.textContent = `← Return to ${handoff.label}`;
}

// The tray is a map-workspace affordance: its snapshots are pinned from the
// globe and its whole point is comparing things in space. Studio routes own
// their right-hand column, so a floating tray there covers their content.
// Visibility is route-scoped, but the snapshots themselves stay in session
// state — navigate away and back and the same comparisons are still pinned.
function comparisonTrayIsAllowedHere() {
  return (window.H2Store?.getState().route || currentRouteFromHash()) === "map";
}

function renderComparisonTray(comparisons = window.H2Store?.getState().comparisons || []) {
  const tray = document.getElementById("comparison-tray");
  const list = document.getElementById("comparison-tray-items");
  if (!tray || !list) return;
  tray.hidden = comparisons.length === 0 || !comparisonTrayIsAllowedHere();
  list.innerHTML = comparisons.map((snapshot) => `
    <article class="comparison-item" data-snapshot-id="${escapeAttr(String(snapshot.id))}">
      <span class="provenance-badge ${snapshot.type === "economics" ? "modeled" : "observed"}">${snapshot.type === "economics" ? "Modeled" : "Observed"}</span>
      <button type="button" class="comparison-open" data-comparison-open="${escapeAttr(String(snapshot.id))}" title="${snapshot.type === "economics" ? "Open in the calculator" : "Open alongside the current project"}">${escapeHtml(snapshot.label)}</button>
      <button type="button" class="comparison-remove" data-comparison-remove="${escapeAttr(String(snapshot.id))}" aria-label="Remove ${escapeAttr(snapshot.label)} from comparison">×</button>
    </article>`).join("");
}

// A tray row is a handle on a stored record, not a caption. Project snapshots
// reopen as full panels in #snapshot-row, where two or three sit side by side
// — that is the actual comparison, and it was unreachable while the rows were
// inert markup. Economics snapshots already have a home in the calculator's
// own scenario table, so their row sends you there rather than duplicating it.
function openComparisonSnapshotById(id, fromRect) {
  const snapshot = (window.H2Store?.getState().comparisons || []).find((item) => String(item.id) === String(id));
  if (!snapshot) return;
  if (snapshot.type === "economics") {
    location.hash = "#/tools";
    requestAnimationFrame(() => document.querySelector('.calc-tab[data-calc="scenario"]')?.click());
    return;
  }
  if (!snapshot.payload?.props || typeof openComparisonSnapshot !== "function") return;
  openComparisonSnapshot("detail-snapshot-" + String(snapshot.id), snapshot.payload.props, fromRect);
}

function wireSharedStateUI() {
  document.getElementById("handoff-return")?.addEventListener("click", returnFromMapHandoff);
  document.getElementById("comparison-tray-items")?.addEventListener("click", (event) => {
    const remove = event.target.closest("[data-comparison-remove]");
    if (remove) {
      window.H2Store?.dispatch({ type: "COMPARISON_REMOVE", payload: { id: remove.dataset.comparisonRemove } });
      return;
    }
    const open = event.target.closest("[data-comparison-open]");
    if (!open) return;
    openComparisonSnapshotById(open.dataset.comparisonOpen, open.getBoundingClientRect());
  });
  window.H2Store?.subscribe((s) => s.handoff, renderHandoffReturn);
  window.H2Store?.subscribe((s) => s.comparisons, renderComparisonTray);
  // Route changes do not alter the comparisons themselves, so the comparisons
  // selector above never fires for them — the tray needs its own subscription
  // to hide on a studio route and reappear on the way back to the map.
  window.H2Store?.subscribe((s) => s.route, () => renderComparisonTray());
  renderHandoffReturn(window.H2Store?.getState().handoff);
  renderComparisonTray();
}

// Slides the pill behind the active tab to its new position/width rather
// than having the fill just pop between buttons — the one bit of the brief's
// "active indicator slides beneath the selected item" that needs JS, since
// each label's expanded width differs and CSS alone can't track that.
//
// Called once right after `.active` is toggled AND again ~340ms later
// (see positionActiveIndicatorSettled below) — the button's <span> label
// animates its own max-width open over 0.32s (see .tab-btn.active span in
// style.css), so an offsetWidth read taken in the same tick as the class
// toggle still measures the PRE-transition collapsed width (icon + padding
// only), leaving the indicator pill sized to just the icon while the label
// renders past its edge.
function positionActiveIndicator() {
  const nav = document.getElementById("tab-nav");
  const indicator = nav && nav.querySelector(".tab-active-indicator");
  const active = nav && nav.querySelector(".tab-btn.active");
  if (!indicator || !active) return;
  // Height is fixed in CSS now (a thin underline, not a filled capsule the
  // size of the button) - only width/position track the active button.
  indicator.style.width = active.offsetWidth + "px";
  indicator.style.transform = `translateX(${active.offsetLeft}px)`;
}
let indicatorSettleTimer = null;
function positionActiveIndicatorSettled() {
  positionActiveIndicator();
  clearTimeout(indicatorSettleTimer);
  indicatorSettleTimer = setTimeout(positionActiveIndicator, 340);
}
window.addEventListener("resize", () => requestAnimationFrame(positionActiveIndicator));

function wireTabNav() {
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const route = btn.dataset.route;
      if (location.hash.slice(1) !== route) location.hash = route;
      navigateTo(route);
    });
  });
}

// Drop zone for project nodes dragged from the Technology constellation
// (js/12-technology.js) — drop a project on the Calculator tab and it
// navigates there, sets it as the universal selection, and prefills the
// Economics mode's capacity slider from it. The 320ms wait after
// navigating is generous on purpose: navigateTo's own crossfade can take
// up to WORKSPACE_FADE_OUT_MS + a build pass before calc-prefill-btn
// exists, and this only runs once per drop, so there's no cost to erring
// long over polling for an element that might not be there yet.
function wireCalculatorDropTarget() {
  const tab = document.querySelector('.tab-btn[data-route="tools"]');
  if (!tab) return;
  tab.addEventListener("dragover", (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    tab.classList.add("drop-target-active");
  });
  tab.addEventListener("dragleave", () => tab.classList.remove("drop-target-active"));
  tab.addEventListener("drop", (e) => {
    e.preventDefault();
    tab.classList.remove("drop-target-active");
    let data;
    try { data = JSON.parse(e.dataTransfer.getData("application/json")); } catch (err) { return; }
    if (!data || !data.props) return;
    window.H2Store?.dispatch({ type: "PROJECT_SELECT", payload: data });
    location.hash = "tools";
    navigateTo("tools");
    setTimeout(() => {
      const econTab = document.querySelector('.calc-tab[data-calc="economics"]');
      if (econTab) econTab.click();
      if (typeof prefillFromSelection === "function") prefillFromSelection();
    }, 320);
  });
}

window.addEventListener("hashchange", () => navigateTo(currentRouteFromHash()));

function initRouter() {
  document.querySelectorAll("[data-prototype-workspace]").forEach((element) => {
    element.hidden = !window.H2G_CONFIG?.ENABLE_PROTOTYPE_WORKSPACES;
  });
  wireTabNav();
  wireCalculatorDropTarget();
  wireSharedStateUI();
  navigateTo(currentRouteFromHash());
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initRouter);
else initRouter();
