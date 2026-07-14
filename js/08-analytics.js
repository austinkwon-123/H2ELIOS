/* ==========================================================================
   H2Grid · Analytics panel
   Network composition bars, live stock tracker, hydrogen industry news.
   Additive HUD module — patches applyFilters, wires the new toggle button.
   Browser classic scripts share one global lexical scope, so map, helpers &
   state from core/filters are visible here. Load order matters — see
   index.html (must load after 03-filters.js and hud.js).
   ======================================================================= */

function wireAnalyticsToggle() {
  const btn = document.getElementById("analytics-btn");
  const panel = document.getElementById("analytics-panel");
  if (!btn || !panel) return;
  btn.addEventListener("click", () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    btn.classList.toggle("active", opening);
  });
}

function initAnalyticsPanel() {
  wireAnalyticsToggle();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAnalyticsPanel);
else initAnalyticsPanel();
