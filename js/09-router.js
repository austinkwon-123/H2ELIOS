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
  if (entry.init && !loadedRoutes[route]) {
    if (typeof window[entry.init] === "function") {
      window[entry.init]();
      loadedRoutes[route] = true;
    } else {
      console.warn(`Router: ${entry.init}() not defined yet for route "${route}"`);
    }
  }
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
