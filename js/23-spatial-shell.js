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
  const preference = document.documentElement.dataset.themePreference || "system";
  document.querySelectorAll("[data-theme-choice]").forEach((button) => {
    const selected = button.dataset.themeChoice === preference;
    button.setAttribute("aria-checked", String(selected));
    button.classList.toggle("selected", selected);
  });
}

function applyThemePreference(preference, persist = true) {
  const safePreference = ["system", "light", "dark"].includes(preference) ? preference : "system";
  const effectiveTheme = safePreference === "system"
    ? (H2ELIOS_SYSTEM_THEME.matches ? "light" : "dark")
    : safePreference;
  document.documentElement.dataset.theme = effectiveTheme;
  document.documentElement.dataset.themePreference = safePreference;
  document.querySelectorAll(".sidebar-lockup").forEach((image) => {
    image.src = effectiveTheme === "light" ? "assets/h2elios-lockup-light.svg" : "assets/h2elios-lockup.svg";
  });
  if (persist) localStorage.setItem(H2ELIOS_THEME_KEY, safePreference);
  syncThemeControls();
}

H2ELIOS_SYSTEM_THEME.addEventListener?.("change", () => {
  if ((localStorage.getItem(H2ELIOS_THEME_KEY) || "system") === "system") applyThemePreference("system", false);
});

function currentWorkspaceRoute() {
  const route = location.hash.replace(/^#\/?/, "");
  return H2ELIOS_WORKSPACES[route] ? route : "map";
}

function updateSpatialShellRoute(route = currentWorkspaceRoute()) {
  const workspace = H2ELIOS_WORKSPACES[route] || H2ELIOS_WORKSPACES.map;
  document.body.dataset.route = route;
  const title = document.getElementById("workspace-title");
  const context = document.getElementById("workspace-context");
  if (title) title.textContent = workspace.title;
  if (context) context.textContent = workspace.context;
}

function setSidebarExpanded(expanded, persist = true) {
  const sidebar = document.getElementById("app-sidebar");
  const toggle = document.getElementById("sidebar-toggle");
  if (!sidebar || !toggle) return;
  document.body.classList.toggle("sidebar-collapsed", !expanded);
  toggle.setAttribute("aria-expanded", String(expanded));
  toggle.setAttribute("aria-label", expanded ? "Collapse sidebar" : "Expand sidebar");
  if (persist) localStorage.setItem("h2elios-sidebar-expanded", String(expanded));
  requestAnimationFrame(() => {
    if (typeof map !== "undefined" && map && typeof map.resize === "function") map.resize();
  });
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
      document.body.classList.toggle("focus-mode");
    } else if (action.startsWith("theme-")) {
      applyThemePreference(action.replace("theme-", ""));
    } else if (action === "geology-reference" && typeof openGeologyPanel === "function") {
      openGeologyPanel();
    } else if (action === "reset-layout") {
      document.body.classList.remove("focus-mode");
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
      document.body.classList.toggle("focus-mode");
    }
  });
}

function initSpatialShell() {
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
  setSidebarExpanded(stored === null ? true : stored === "true", false);
  applyThemePreference(localStorage.getItem(H2ELIOS_THEME_KEY) || "system", false);
  sidebarToggle?.addEventListener("click", () => {
    setSidebarExpanded(document.body.classList.contains("sidebar-collapsed"));
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
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initSpatialShell);
} else {
  initSpatialShell();
}
