/* H2ELIOS Spatial Intelligence shell.
   Keeps the existing router, map controls, filters and panel IDs intact while
   presenting them through one macOS-inspired toolbar and sidebar. */

const H2ELIOS_WORKSPACES = {
  map: { title: "Explore", context: "Spatial Observatory" },
  market: { title: "Economics", context: "Research Studio" },
  technology: { title: "Technology", context: "Research Studio" },
  "demand-transport": { title: "Demand", context: "Research Studio" },
  policy: { title: "Policy", context: "Research Studio" },
  timeline: { title: "Timeline", context: "Research Studio" },
  companies: { title: "Organizations", context: "Research Studio" },
  tools: { title: "Calculator", context: "Research Studio" }
};

const H2ELIOS_THEME_KEY = "h2elios-theme";
const H2ELIOS_SYSTEM_THEME = window.matchMedia("(prefers-color-scheme: light)");

function syncThemeControls() {
  const preference = document.documentElement.dataset.themePreference || "dark";
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    const selected = button.dataset.themeChoice === preference;
    button.setAttribute("aria-checked", String(selected));
    button.classList.toggle("selected", selected);
  });
}

function applyThemePreference(preference, persist = true) {
  const safePreference = ["system", "light", "dark"].includes(preference) ? preference : "dark";
  const effectiveTheme = safePreference === "system"
    ? (H2ELIOS_SYSTEM_THEME.matches ? "light" : "dark")
    : safePreference;
  document.documentElement.dataset.theme = effectiveTheme;
  document.documentElement.dataset.themePreference = safePreference;
  if (typeof setTheme === "function") setTheme(effectiveTheme);
  document.querySelectorAll(".sidebar-lockup").forEach((image) => {
    image.src = effectiveTheme === "light" ? "assets/h2elios-lockup-light.svg" : "assets/h2elios-lockup.svg";
  });
  if (persist && window.H2Store?.getState().theme !== safePreference) {
    window.H2Store?.dispatch({ type: "THEME_CHANGE", payload: { theme: safePreference } });
  }
  syncThemeControls();
  requestAnimationFrame(syncCanvasVisualizationTheme);
}

const DAYLIGHT_CHART_INK = {
  "#34d399": "#087a55",
  "#60a5fa": "#245db5",
  "#f472b6": "#ad326e",
  "#2dd4bf": "#0b7480",
  "#3fd6e8": "#0b7480",
  "#a78bfa": "#6243a8",
  "#fbbf24": "#8a4c08",
  "#94a3b8": "#52657a"
};

function daylightChartColor(value) {
  if (Array.isArray(value)) return value.map(daylightChartColor);
  if (typeof value !== "string") return value;
  return DAYLIGHT_CHART_INK[value.toLowerCase()] || value;
}

function chartInstanceList() {
  if (typeof Chart === "undefined" || !Chart.instances) return [];
  return Chart.instances instanceof Map ? Array.from(Chart.instances.values()) : Object.values(Chart.instances);
}

// Applied to charts as they are created (via the plugin below) and to every
// live chart when the theme changes. Repainting on creation is what removes the
// need to guess how long a workspace takes to build its canvases.
function applyChartTheme(chart, { redraw = true } = {}) {
  const light = document.documentElement.dataset.theme === "light";
  const textColor = light ? "#52525a" : "#b6c2d4";
  const gridColor = light ? "rgba(60,60,67,.13)" : "rgba(255,255,255,.07)";
  const chartEdge = light ? "rgba(255,255,255,.94)" : "#0a0e16";
  {
    if (!chart?.options) return;
    chart.options.color = textColor;
    const legendLabels = chart.options.plugins?.legend?.labels;
    if (legendLabels) legendLabels.color = textColor;
    Object.values(chart.options.scales || {}).forEach((scale) => {
      if (scale.ticks) scale.ticks.color = textColor;
      if (scale.grid) scale.grid.color = gridColor;
      if (scale.title) scale.title.color = textColor;
    });
    chart.data.datasets.forEach((dataset) => {
      if (!("_h2eliosNightBorderColor" in dataset)) dataset._h2eliosNightBorderColor = dataset.borderColor;
      if (!("_h2eliosNightBackgroundColor" in dataset)) dataset._h2eliosNightBackgroundColor = dataset.backgroundColor;
      dataset.borderColor = light ? daylightChartColor(dataset._h2eliosNightBorderColor) : dataset._h2eliosNightBorderColor;
      dataset.backgroundColor = light ? daylightChartColor(dataset._h2eliosNightBackgroundColor) : dataset._h2eliosNightBackgroundColor;
    });
    if (["doughnut", "pie"].includes(chart.config?.type)) {
      chart.data.datasets.forEach((dataset) => { dataset.borderColor = chartEdge; });
    }
    // Skipped on creation: the chart has not drawn yet, and calling update()
    // from inside afterInit re-enters Chart.js mid-construction.
    if (redraw) chart.update("none");
  }
}

function syncCanvasVisualizationTheme() {
  chartInstanceList().forEach((chart) => applyChartTheme(chart));
}

// Charts are built lazily, whenever a workspace route first renders. Theming
// them from a plugin hook means a chart is correct the moment it exists,
// instead of depending on a timer racing the workspace's own render.
if (typeof Chart !== "undefined" && typeof Chart.register === "function") {
  Chart.register({
    id: "h2eliosTheme",
    afterInit(chart) { applyChartTheme(chart, { redraw: false }); }
  });
}

function syncSpatialMapPadding() {
  if (typeof map === "undefined" || !map || typeof map.setPadding !== "function") return;
  const desktop = window.innerWidth > 720;
  const onMap = currentWorkspaceRoute() === "map";
  // Focus mode translates the sidebar and the ribbon off-screen. They keep
  // their widths while hidden, so padding measured from offsetWidth reserved
  // 232px for furniture nobody can see and pushed the globe a sixth of the way
  // off centre — most visible in the film, which runs entirely in focus mode.
  const focused = document.body.classList.contains("focus-mode");
  const sidebar = focused ? null : document.getElementById("app-sidebar");
  const inspector = document.querySelector(".right-panel-slot:not([hidden])");
  const padding = desktop && onMap ? {
    top: focused ? 0 : 58,
    right: inspector ? inspector.offsetWidth + 32 : 0,
    // The globe's visual centre sits below its geographic target at orbital
    // zooms. Bottom padding raises the sphere into the desktop's primary
    // canvas instead of leaving the upper half of the screen unused.
    bottom: window.innerHeight >= 780 ? 180 : 96,
    left: sidebar ? sidebar.offsetWidth : 0
  } : { top: 0, right: 0, bottom: 0, left: 0 };
  try { map.setPadding(padding); } catch (error) { /* map style can still be booting */ }
}

H2ELIOS_SYSTEM_THEME.addEventListener?.("change", () => {
  if ((window.H2Store?.getState().theme || "dark") === "system") applyThemePreference("system", false);
});

function currentWorkspaceRoute() {
  const route = location.hash.replace(/^#\/?/, "");
  return H2ELIOS_WORKSPACES[route] ? route : "map";
}

function closeMapInspectorsForStudio(route) {
  if (route === "map") return;

  // Map inspectors are intentionally contextual. Leaving one visible over a
  // research workspace covers its right-hand content and makes the new route
  // look broken, particularly on wide desktop layouts.
  //
  // The detail card goes through its own teardown rather than just being
  // hidden: hiding it alone leaves selectedName set, and the live-data refresh
  // re-selects by name (18-api-live.js), which would pop the map inspector back
  // open on top of the workspace the user just navigated to. Focus restore is
  // suppressed so it stays in the new route.
  const detailCard = document.getElementById("detail-card");
  if (detailCard && !detailCard.hidden && typeof closeDetailPanel === "function") closeDetailPanel(false);
  document.querySelectorAll(".right-panel-slot:not([hidden])").forEach((panel) => {
    panel.hidden = true;
  });
  document.getElementById("analytics-btn")?.classList.remove("active");
  document.getElementById("markets-btn")?.classList.remove("active");
  if (typeof stopMarketsPolling === "function") stopMarketsPolling();
  if (typeof setSearchResultsOpen === "function") setSearchResultsOpen(false);
}

function updateSpatialShellRoute(route = currentWorkspaceRoute()) {
  const workspace = H2ELIOS_WORKSPACES[route] || H2ELIOS_WORKSPACES.map;
  closeMapInspectorsForStudio(route);
  document.body.dataset.route = route;
  const title = document.getElementById("workspace-title");
  const context = document.getElementById("workspace-context");
  if (title) title.textContent = workspace.title;
  if (context) context.textContent = workspace.context;
  document.querySelectorAll("#tab-nav .tab-btn[data-route]").forEach((button) => {
    if (button.dataset.route === route) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  requestAnimationFrame(syncSpatialMapPadding);
  // Charts created by this route theme themselves via the h2eliosTheme plugin,
  // so there is nothing to wait for here.
}

// Each control is wired independently. One binder throwing — a missing node, a
// map call that lands before the style is ready — must not cost the user every
// control wired after it, nor the shell init that follows this function.
// One observer for the map's right-hand inspectors. Both the search dropdown's
// geometry and the map's edge padding have to react when a panel opens or
// closes; two MutationObservers watching the same nodes for the same attribute
// was duplicated work that could drift apart.
const rightPanelToggleListeners = [];
let rightPanelObserver = null;
let rightPanelArbitrating = false;

function onRightPanelToggle(handler) {
  if (typeof handler !== "function") return;
  rightPanelToggleListeners.push(handler);
  if (rightPanelObserver) return;
  rightPanelObserver = new MutationObserver((records) => {
    // Most openers already call closeOtherRightPanels(), but live refreshes,
    // restored inspectors and future integrations can reveal a panel by
    // changing `hidden` directly. On narrow screens every inspector owns the
    // same bottom sheet rectangle, so one missed call produces two fully
    // overlapping scroll surfaces. Treat the newly revealed panel as the
    // owner here as a last-line invariant, independent of which code opened
    // it. The guard prevents the close mutations from recursively arbitrating.
    const changedPanels = [];
    records.forEach((record) => {
      if (record.type === "attributes" && record.target.matches?.(".right-panel-slot")) {
        changedPanels.push(record.target);
      }
      record.addedNodes?.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches(".right-panel-slot")) changedPanels.push(node);
        changedPanels.push(...node.querySelectorAll(".right-panel-slot"));
      });
    });
    if (!changedPanels.length) return;
    const opened = changedPanels.filter((panel) => !panel.hidden).pop();
    if (opened && !rightPanelArbitrating && typeof closeOtherRightPanels === "function") {
      rightPanelArbitrating = true;
      try {
        // A comparison snapshot is allowed beside the live detail inspector on
        // desktop; that pairing is the comparison feature. It still conflicts
        // with Insights/Markets, while mobile has only one bottom-sheet slot
        // and therefore keeps the stricter single-inspector rule.
        const exceptId = opened.classList.contains("detail-snapshot") && window.innerWidth > 720
          ? "detail-card"
          : opened.id;
        closeOtherRightPanels(exceptId);
      }
      finally { rightPanelArbitrating = false; }
    }
    rightPanelToggleListeners.forEach((listener) => {
      try { listener(); }
      catch (error) { console.error("H2ELIOS: inspector-toggle listener failed", error); }
    });
  });
  // Observe the body rather than only the five panels present at startup.
  // Restored comparison/detail panels are created later in #snapshot-row and
  // arrive already visible, so there is no subsequent `hidden` mutation an
  // observer attached to the startup nodes could ever see.
  rightPanelObserver.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["hidden"]
  });
}

function wireCoreDomControlsOnce() {
  if (window.H2ELIOS_DOM_CONTROLS_WIRED) return;
  window.H2ELIOS_DOM_CONTROLS_WIRED = true;
  [wireDock, wireSegments, wireLegend, wireFlyouts, wireSearch, wireSearchHotkey, wireDetailClose, wireTheme, renderStats]
    .forEach((wire) => {
      if (typeof wire !== "function") return;
      try { wire(); }
      catch (error) { console.error(`H2ELIOS: ${wire.name || "control"} failed to initialize`, error); }
    });
}

function setSidebarExpanded(expanded, persist = true) {
  const sidebar = document.getElementById("app-sidebar");
  const toggle = document.getElementById("sidebar-toggle");
  if (!sidebar || !toggle) return;
  document.body.classList.toggle("sidebar-collapsed", !expanded);
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.setAttribute("aria-label", expanded ? "Collapse sidebar" : "Expand sidebar");
  const filter = document.getElementById("sidebar-filter");
  if (filter) filter.tabIndex = expanded ? 0 : -1;
  if (persist) localStorage.setItem("h2elios-sidebar-expanded", String(expanded));
  syncShellGeometryAfterSidebarSettles(sidebar);
}

// The sidebar animates its width over 0.3s. syncSpatialMapPadding() reads
// sidebar.offsetWidth, so running it one frame after the class flip sampled
// the START of that animation: expanding to 232px left the map's padding at
// the collapsed 56px and nothing ever corrected it, so the globe sat 176px
// off-centre, partly under the sidebar, until an unrelated event happened to
// re-sync. Sync once immediately (never worse than before) and again once the
// width has actually settled. The timer is the fallback for when no
// transition runs at all — prefers-reduced-motion, or a width that resolves
// instantly — since transitionend would never fire in those cases.
function syncShellGeometryAfterSidebarSettles(sidebar) {
  requestAnimationFrame(syncSpatialMapPadding);
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    sidebar.removeEventListener("transitionend", onTransitionEnd);
    clearTimeout(fallback);
    if (typeof map !== "undefined" && map && typeof map.resize === "function") map.resize();
    syncSpatialMapPadding();
  };
  function onTransitionEnd(event) {
    if (event.target === sidebar && event.propertyName === "width") settle();
  }
  sidebar.addEventListener("transitionend", onTransitionEnd);
  const fallback = setTimeout(settle, 450);
}

function labelSidebarControls() {
  document.querySelectorAll("#layer-dock .dock-btn, #layer-dock .flyout-trigger").forEach((button) => {
    if (button.querySelector(".sidebar-item-label")) return;
    const label = document.createElement("span");
    label.className = "sidebar-item-label";
    label.textContent = button.getAttribute("aria-label") || button.dataset.tip || "Control";
    button.appendChild(label);
  });
}

function filterSidebar(query) {
  const normalized = query.trim().toLowerCase();
  document.querySelectorAll("#tab-nav .tab-btn, #layer-dock .dock-btn, #layer-dock .flyout-trigger").forEach((button) => {
    const label = (button.getAttribute("aria-label") || button.textContent || "").toLowerCase();
    button.toggleAttribute("data-filtered-out", !!normalized && !label.includes(normalized));
  });
}

function setFocusMode(enabled) {
  document.body.classList.toggle("focus-mode", !!enabled);
  const focusAction = document.querySelector('[data-shell-action="focus-mode"]');
  if (focusAction) {
    focusAction.setAttribute("aria-pressed", String(!!enabled));
    const label = focusAction.querySelector("span");
    if (label) label.textContent = enabled ? "Exit focus mode" : "Focus on workspace";
  }
}

function createToolbarMenu() {
  const trigger = document.getElementById("toolbar-more");
  if (!trigger || document.getElementById("toolbar-menu")) return;
  const menu = document.createElement("div");
  menu.id = "toolbar-menu";
  menu.className = "glass toolbar-menu";
  menu.setAttribute("role", "menu");
  menu.hidden = true;
  menu.innerHTML = `
    <button type="button" role="menuitem" data-shell-action="toggle-sidebar"><span>Toggle sidebar</span><kbd>⌥S</kbd></button>
    <button type="button" role="menuitem" data-shell-action="focus-mode"><span>Focus on workspace</span><kbd>⇧F</kbd></button>
    <div class="menu-separator" role="separator"></div>
    <div class="menu-label">Appearance</div>
    <button type="button" role="menuitemradio" data-shell-action="theme-system" data-theme-choice="system"><span>System</span><span class="menu-check" aria-hidden="true">✓</span></button>
    <button type="button" role="menuitemradio" data-shell-action="theme-light" data-theme-choice="light"><span>Light</span><span class="menu-check" aria-hidden="true">✓</span></button>
    <button type="button" role="menuitemradio" data-shell-action="theme-dark" data-theme-choice="dark"><span>Dark</span><span class="menu-check" aria-hidden="true">✓</span></button>
    <div class="menu-separator" role="separator"></div>
    <button type="button" role="menuitem" data-shell-action="start-demo"><span>Start walkthrough</span></button>
    <button type="button" role="menuitem" data-shell-action="geology-reference"><span>Geology reference</span></button>
    <button type="button" role="menuitem" data-shell-action="reset-layout"><span>Reset layout</span></button>`;
  document.body.appendChild(menu);
  syncThemeControls();

  const close = () => {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  };
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    const opening = menu.hidden;
    menu.hidden = !opening;
    trigger.setAttribute("aria-expanded", String(opening));
  });
  menu.addEventListener("click", (event) => {
    const action = event.target.closest("[data-shell-action]")?.dataset.shellAction;
    if (!action) return;
    if (action === "toggle-sidebar") {
      setSidebarExpanded(document.body.classList.contains("sidebar-collapsed"));
    } else if (action === "focus-mode") {
      setFocusMode(!document.body.classList.contains("focus-mode"));
    } else if (action.startsWith("theme-")) {
      applyThemePreference(action.replace("theme-", ""));
    } else if (action === "geology-reference" && typeof openGeologyPanel === "function") {
      openGeologyPanel();
    } else if (action === "start-demo") {
      document.getElementById("demo-btn")?.click();
    } else if (action === "reset-layout") {
      setFocusMode(false);
      setSidebarExpanded(true);
      document.querySelectorAll(".right-panel-slot:not([hidden])").forEach((panel) => {
        if (panel.id === "detail-card" && document.getElementById("detail-close")) {
          document.getElementById("detail-close").click();
        } else if (panel.id === "analytics-panel" && typeof closeAnalyticsPanel === "function") {
          closeAnalyticsPanel();
        } else if (panel.id === "markets-panel" && typeof closeMarketsPanel === "function") {
          closeMarketsPanel();
        } else {
          panel.hidden = true;
        }
      });
    }
    close();
  });
  document.addEventListener("click", (event) => {
    if (!menu.hidden && !menu.contains(event.target) && event.target !== trigger) close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
    if (event.altKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      setSidebarExpanded(document.body.classList.contains("sidebar-collapsed"));
    }
    if (event.shiftKey && event.key.toLowerCase() === "f" && !/input|textarea|select/i.test(document.activeElement?.tagName || "")) {
      event.preventDefault();
      setFocusMode(!document.body.classList.contains("focus-mode"));
    }
  });
}

function initSpatialShell() {
  wireCoreDomControlsOnce();
  const sidebarSlot = document.getElementById("sidebar-map-tools");
  const layerDock = document.getElementById("layer-dock");
  const toolbarCenter = document.getElementById("ribbon-zone-b");
  const mapModeSwitch = document.getElementById("map-mode-switch");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  const sidebarFilter = document.getElementById("sidebar-filter");

  if (sidebarSlot && layerDock) sidebarSlot.appendChild(layerDock);
  if (toolbarCenter && mapModeSwitch) toolbarCenter.appendChild(mapModeSwitch);
  labelSidebarControls();

  const stored = localStorage.getItem("h2elios-sidebar-expanded");
  setSidebarExpanded(stored === null ? window.innerWidth > 1100 : stored === "true", false);
  applyThemePreference(window.H2Store?.getState().theme || "dark", false);
  window.H2Store?.subscribe((state) => state.theme, (theme) => applyThemePreference(theme, false));
  sidebarToggle?.addEventListener("click", () => {
    setSidebarExpanded(document.body.classList.contains("sidebar-collapsed"));
  });
  // Overlay-drawer dismissal below 1100px. The scrim is a body::after
  // pseudo-element, so its clicks land on <body> itself — anything outside the
  // sidebar and outside the toggle counts as a tap on the scrim.
  const sidebarIsOverlay = () =>
    window.innerWidth <= 1100 && !document.body.classList.contains("sidebar-collapsed");
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebarIsOverlay()) {
      setSidebarExpanded(false);
      sidebarToggle?.focus();
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!sidebarIsOverlay()) return;
    // Not every pointer target is an Element (document, text nodes), and
    // closest() only exists on Elements.
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("#app-sidebar, #sidebar-toggle")) return;
    setSidebarExpanded(false);
  });
  sidebarFilter?.addEventListener("input", () => filterSidebar(sidebarFilter.value));
  sidebarFilter?.addEventListener("focus", () => setSidebarExpanded(true));

  document.getElementById("tab-nav")?.addEventListener("click", (event) => {
    const route = event.target.closest(".tab-btn")?.dataset.route;
    if (route) updateSpatialShellRoute(route);
  });
  window.addEventListener("hashchange", () => updateSpatialShellRoute());
  updateSpatialShellRoute();
  createToolbarMenu();
  onRightPanelToggle(() => requestAnimationFrame(syncSpatialMapPadding));
  window.addEventListener("resize", () => requestAnimationFrame(syncSpatialMapPadding));
  if (typeof map !== "undefined" && map?.on) {
    map.on("load", syncSpatialMapPadding);
    map.on("moveend", () => {
      const center = map.getCenter();
      window.H2Store?.dispatch({
        type: "MAP_CAMERA_UPDATE",
        payload: { center: [center.lng, center.lat], zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing() }
      });
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSpatialShell);
} else {
  initSpatialShell();
}
