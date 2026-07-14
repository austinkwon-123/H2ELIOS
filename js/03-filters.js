/* ==========================================================================
   H2Grid · Filters & dock
   Status/region/color filters, layer dock, legend. Owns TOGGLE_MAP & REGION_GROUPS.
   Browser classic scripts share one global lexical scope, so map, helpers &
   state from core are visible here. Load order matters — see index.html.
   ======================================================================= */

// ---- Filters -------------------------------------------------------------------------------
const REGION_GROUPS = {
  americas: ["americas", "latam"],
  europe: ["europe"],
  mena: ["mena", "africa"],
  apac: ["apac"]
};

function regionExpr() {
  return ["in", ["get", "region"], ["literal", REGION_GROUPS[regionFilter] || []]];
}

function currentFilter() {
  const parts = ["all"];
  if (statusFilter !== "all") parts.push(["==", ["get", "statusClass"], statusFilter]);
  if (regionFilter !== "all") parts.push(regionExpr());
  if (colorFilter) parts.push(["==", ["get", "color"], colorFilter]);
  return parts.length > 1 ? parts : null;
}

function applyFilters() {
  const f = currentFilter();
  const targets = [
    "upstream", "upstream-glow", "production", "production-glow",
    "manufacturing", "manufacturing-glow",
    "storage", "storage-glow", "endUse", "endUse-glow",
    "fuelingStations", "fuelingStations-glow",
    "pipelines", "pipelines-glow", "pipelines-dash"
  ];
  targets.forEach((id) => { if (map.getLayer(id)) map.setFilter(id, f); });

  // Hubs respect region + status only (color is "focus" there)
  const hubParts = ["all"];
  if (regionFilter !== "all") hubParts.push(regionExpr());
  if (statusFilter !== "all") hubParts.push(["==", ["get", "statusClass"], statusFilter]);
  const hf = hubParts.length > 1 ? hubParts : null;
  ["hubs", "hubs-outline", "hub-labels"].forEach((id) => { if (map.getLayer(id)) map.setFilter(id, hf); });

  renderSearchResults();
}

function wireSegments() {
  document.querySelectorAll("#status-seg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#status-seg .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      statusFilter = btn.dataset.status;
      applyFilters();
    });
  });
  document.querySelectorAll("#region-seg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#region-seg .seg-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      regionFilter = btn.dataset.region;
      stopSpin();
      applyFilters();
      const views = {
        all: { center: [15, 20], zoom: 1.7 },
        americas: { center: [-95, 30], zoom: 2.8 },
        europe: { center: [8, 51], zoom: 3.9 },
        mena: { center: [38, 15], zoom: 3.0 },
        apac: { center: [122, 15], zoom: 2.8 }
      };
      map.flyTo({ ...(views[regionFilter] || views.all), duration: 1800 });
    });
  });
}

function wireLegend() {
  document.querySelectorAll(".legend-dot").forEach((btn) => {
    btn.addEventListener("click", () => {
      const c = btn.dataset.color;
      colorFilter = colorFilter === c ? null : c;
      document.querySelectorAll(".legend-dot").forEach((b) => {
        b.classList.toggle("active", colorFilter === b.dataset.color);
        b.classList.toggle("dimmed", !!colorFilter && colorFilter !== b.dataset.color);
      });
      applyFilters();
    });
  });
}


// ---- Layer dock -------------------------------------------------------------------------------
const TOGGLE_MAP = {
  upstream: ["upstream", "upstream-glow"],
  production: ["production", "production-glow"],
  manufacturing: ["manufacturing", "manufacturing-glow"],
  storage: ["storage", "storage-glow"],
  pipelines: ["pipelines", "pipelines-glow", "pipelines-dash"],
  endUse: ["endUse", "endUse-glow"],
  fuelingStations: ["fuelingStations", "fuelingStations-glow"],
  hubs: ["hubs", "hubs-outline", "hub-labels"],
  flows: ["flows-base", "flows-dash", "flow-particles"],
  web: ["web", "web-glow"]
};

function wireDock() {
  document.querySelectorAll(".dock-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");
      const on = btn.classList.contains("active");
      (TOGGLE_MAP[btn.dataset.layer] || []).forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
      });
      renderSearchResults();
    });
  });
}

function layerVisible(key) {
  const btn = document.querySelector(`.dock-btn[data-layer="${key}"]`);
  return btn ? btn.classList.contains("active") : true;
}
