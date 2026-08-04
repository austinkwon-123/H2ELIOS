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
  tools: { page: "page-tools", init: "initToolsPage" },
  timeline: { page: "page-timeline", init: "initTimelinePage" }
};
const loadedRoutes = {};

function currentRouteFromHash() {
  const h = location.hash.slice(1);
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
  const entry = ROUTES[route];
  const incomingEl = document.getElementById(entry.page);
  const outgoingRoute = Object.keys(ROUTES).find((r) => {
    const el = document.getElementById(ROUTES[r].page);
    return el && !el.hidden && r !== route;
  });
  const outgoingEl = outgoingRoute ? document.getElementById(ROUTES[outgoingRoute].page) : null;

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
  indicator.style.width = active.offsetWidth + "px";
  indicator.style.height = active.offsetHeight + "px";
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
    window.H2GSelection = data;
    if (typeof updateSelectionChip === "function") updateSelectionChip();
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
  wireTabNav();
  wireCalculatorDropTarget();
  navigateTo(currentRouteFromHash());
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initRouter);
else initRouter();
