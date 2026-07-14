/* ==========================================================================
   H2Grid · Analytics panel
   Network composition bars, live stock tracker, hydrogen industry news.
   Additive HUD module — patches applyFilters, wires the new toggle button.
   Browser classic scripts share one global lexical scope, so map, helpers &
   state from core/filters are visible here. Load order matters — see
   index.html (must load after 03-filters.js and hud.js).
   ======================================================================= */

const TAXONOMY_ORDER = ["green", "blue", "pink", "turquoise", "gray_blue", "brown", "mfg"];
const TAXONOMY_LABELS = {
  green: "Green", blue: "Blue", pink: "Pink", turquoise: "Turquoise",
  gray_blue: "Gray", brown: "Brown", mfg: "Mfg"
};

function computeColorCounts() {
  const feats = [
    ...D.upstream.features, ...D.production.features, ...D.manufacturing.features,
    ...D.storagePoints.features, ...D.pipelines.features, ...D.endUse.features
  ];
  const counts = {};
  TAXONOMY_ORDER.forEach((k) => { counts[k] = 0; });
  feats.forEach((f) => {
    const p = f.properties;
    if (statusFilter !== "all" && p.statusClass !== statusFilter) return;
    if (regionFilter !== "all" && !(REGION_GROUPS[regionFilter] || []).includes(p.region)) return;
    if (counts.hasOwnProperty(p.color)) counts[p.color]++;
  });
  return counts;
}

function renderNetworkBars() {
  const el = document.getElementById("analytics-network");
  if (!el) return;
  const counts = computeColorCounts();
  const max = Math.max(1, ...TAXONOMY_ORDER.map((k) => counts[k]));
  el.innerHTML = TAXONOMY_ORDER.map((k) => {
    const n = counts[k];
    const pct = Math.round((n / max) * 100);
    return `<div class="bar-row">
      <span class="bar-label">${TAXONOMY_LABELS[k]}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${COLORS[k]}"></span></span>
      <span class="bar-count">${n}</span>
    </div>`;
  }).join("");
}

function wireAnalyticsToggle() {
  const btn = document.getElementById("analytics-btn");
  const panel = document.getElementById("analytics-panel");
  if (!btn || !panel) return;
  btn.addEventListener("click", () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    btn.classList.toggle("active", opening);
    if (opening) renderNetworkBars();
  });
}

function initAnalyticsPanel() {
  wireAnalyticsToggle();
  renderNetworkBars();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAnalyticsPanel);
else initAnalyticsPanel();

// Keep the Network bars live-linked to the status/region filters.
const _applyFilters = applyFilters;
applyFilters = function () {
  _applyFilters();
  renderNetworkBars();
};
