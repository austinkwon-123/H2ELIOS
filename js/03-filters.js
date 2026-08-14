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

function syncFiltersFromStore() {
  const filters = window.H2Store?.getState().filters;
  if (!filters) return;
  statusFilter = filters.status || "all";
  regionFilter = filters.region || "all";
  colorFilter = filters.color || null;
  document.querySelectorAll("#status-seg .seg-btn").forEach((button) => {
    const active = button.dataset.status === statusFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("#region-seg .seg-btn").forEach((button) => {
    const active = button.dataset.region === regionFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll(".legend-dot").forEach((button) => {
    button.classList.toggle("active", colorFilter === button.dataset.color);
    button.classList.toggle("dimmed", Boolean(colorFilter) && colorFilter !== button.dataset.color);
    button.setAttribute("aria-pressed", String(colorFilter === button.dataset.color));
  });
}

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
  document.querySelectorAll("#status-seg .seg-btn, #region-seg .seg-btn").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.classList.contains("active")));
  });
  document.querySelectorAll("#status-seg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#status-seg .seg-btn").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      window.H2Store?.dispatch({ type: "FILTER_UPDATE", payload: { key: "status", value: btn.dataset.status } });
      syncFiltersFromStore();
      applyFilters();
    });
  });
  document.querySelectorAll("#region-seg .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#region-seg .seg-btn").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-pressed", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-pressed", "true");
      window.H2Store?.dispatch({ type: "FILTER_UPDATE", payload: { key: "region", value: btn.dataset.region } });
      syncFiltersFromStore();
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
    btn.setAttribute("aria-pressed", String(btn.classList.contains("active")));
    btn.addEventListener("click", () => {
      const c = btn.dataset.color;
      window.H2Store?.dispatch({ type: "FILTER_UPDATE", payload: { key: "color", value: colorFilter === c ? null : c } });
      syncFiltersFromStore();
      document.querySelectorAll(".legend-dot").forEach((b) => {
        b.classList.toggle("active", colorFilter === b.dataset.color);
        b.classList.toggle("dimmed", !!colorFilter && colorFilter !== b.dataset.color);
        b.setAttribute("aria-pressed", String(colorFilter === b.dataset.color));
      });
      applyFilters();
    });
  });
}

function closeFlyout(trigger, panel) {
  panel.hidden = true;
  panel.style.top = "";
  trigger.classList.remove("active");
  trigger.setAttribute("aria-expanded", "false");
}

function wireFlyouts() {
  const entries = ["status", "region", "color"].map((k) => ({
    key: k,
    trigger: document.getElementById(`filter-${k}-trigger`),
    panel: document.getElementById(`flyout-${k}`)
  }));

  entries.forEach(({ trigger, panel }) => {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = !panel.hidden;
      entries.forEach((entry) => closeFlyout(entry.trigger, entry.panel));
      if (!isOpen) {
        panel.style.top = `${trigger.getBoundingClientRect().top}px`;
        panel.hidden = false;
        trigger.classList.add("active");
        trigger.setAttribute("aria-expanded", "true");
      }
    });
  });

  document.addEventListener("click", (e) => {
    entries.forEach(({ trigger, panel }) => {
      if (!panel.hidden && !panel.contains(e.target) && !trigger.contains(e.target)) {
        closeFlyout(trigger, panel);
      }
    });
  });

}


// ---- Layer dock -------------------------------------------------------------------------------
const TOGGLE_MAP = {
  facilities: ["upstream", "upstream-glow", "production", "production-glow", "manufacturing", "manufacturing-glow", "storage", "storage-glow", "endUse", "endUse-glow"],
  pipelines: ["pipelines", "pipelines-glow", "pipelines-dash"],
  fueling: ["fuelingStations", "fuelingStations-glow"],
  hubs: ["hubs", "hubs-outline", "hub-labels"]
};

function wireDock() {
  document.querySelectorAll(".dock-btn").forEach((btn) => {
    btn.setAttribute("aria-pressed", String(btn.classList.contains("active")));
    btn.addEventListener("click", () => {
      btn.classList.toggle("active");
      const on = btn.classList.contains("active");
      btn.setAttribute("aria-pressed", String(on));
      window.H2Store?.dispatch({ type: "MAP_LAYER_UPDATE", payload: { key: btn.dataset.layer, value: on } });
      (TOGGLE_MAP[btn.dataset.layer] || []).forEach((id) => {
        if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
      });
      // Custom WebGL layers do not have a MapLibre layout.visibility value.
      // Keep the raised conduit attached to the same Pipelines control as the
      // three draped source layers, rather than giving one dataset two states.
      if (btn.dataset.layer === "pipelines") window.H2GPipelines?.setVisible(on);
      renderSearchResults();
    });
  });
  syncDockLayers();
}

function syncDockLayers() {
  document.querySelectorAll(".dock-btn[data-layer]").forEach((btn) => {
    const on = btn.classList.contains("active");
    (TOGGLE_MAP[btn.dataset.layer] || []).forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    });
    if (btn.dataset.layer === "pipelines") window.H2GPipelines?.setVisible(on);
  });
}
map.on("load", syncDockLayers);

syncFiltersFromStore();

function layerVisible(key) {
  const btn = document.querySelector(`.dock-btn[data-layer="${key}"]`);
  return btn ? btn.classList.contains("active") : true;
}
