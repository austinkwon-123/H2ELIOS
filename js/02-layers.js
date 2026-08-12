/* ==========================================================================
   H2Grid · Map layers
   Network web, DOE hubs, flow arcs, point/line builders, selection ring, animations.
   Browser classic scripts share one global lexical scope, so map, helpers &
   state from core are visible here. Load order matters — see index.html.
   ======================================================================= */

// ---- Network web -------------------------------------------------------------
function addWebLayer() {
  const web = buildNetworkWeb();
  map.addSource("web", { type: "geojson", data: web });
  // Hidden by default and no longer in the dock. This layer draws an
  // *illustrative* mesh between nodes — it is not a real network, and it was
  // the one layer on the map contradicting the data-honesty pass. The geometry
  // is kept so it can be re-enabled deliberately, but it no longer ships on.
  map.addLayer({
    id: "web-glow", type: "line", source: "web",
    layout: { visibility: "none" },
    paint: { "line-color": "#3fd6e8", "line-width": 2, "line-opacity": 0.05, "line-blur": 3 }
  });
  map.addLayer({
    id: "web", type: "line", source: "web",
    layout: { visibility: "none" },
    paint: { "line-color": "#5fd9ea", "line-width": 0.55, "line-opacity": 0.2 }
  });
}


// ---- Hubs ----------------------------------------------------------------------
function addHubLayers() {
  const polys = {
    type: "FeatureCollection",
    features: D.hubs.map((h) => ({ type: "Feature", geometry: circlePolygon(h.center, h.radiusKm), properties: hubProps(h) }))
  };
  const labels = {
    type: "FeatureCollection",
    features: D.hubs.map((h) => ({ type: "Feature", geometry: { type: "Point", coordinates: h.center }, properties: hubProps(h) }))
  };

  map.addSource("hubs", { type: "geojson", data: polys });
  map.addSource("hub-labels", { type: "geojson", data: labels });

  map.addLayer({
    id: "hubs", type: "fill", source: "hubs",
    paint: {
      "fill-color": ["case", ["==", ["get", "funding"], "terminated"], "#f87171", "#34e0a1"],
      "fill-opacity": 0.05
    }
  });
  map.addLayer({
    id: "hubs-outline", type: "line", source: "hubs",
    paint: {
      "line-color": ["case", ["==", ["get", "funding"], "terminated"], "#f87171", "#34e0a1"],
      "line-width": 1.4,
      "line-opacity": 0.5,
      "line-dasharray": [3, 2]
    }
  });
  map.addLayer({
    id: "hub-labels", type: "symbol", source: "hub-labels",
    layout: {
      "text-field": ["get", "short"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 11,
      "text-letter-spacing": 0.15,
      "text-transform": "uppercase"
    },
    paint: {
      "text-color": ["case", ["==", ["get", "funding"], "terminated"], "#fca5a5", "#6ee7c5"],
      "text-halo-color": "#01030a",
      "text-halo-width": 1.4
    }
  });
}

function hubProps(h) {
  return {
    name: h.name, short: h.short, category: "hub", subtype: "DOE Regional Clean Hydrogen Hub",
    color: h.colorFocus, capacity: h.award,
    status: h.funding === "terminated" ? "Federal funding terminated" : "Federally funded",
    statusClass: h.funding === "terminated" ? "atrisk" : "operating",
    operator: h.states, funding: h.funding, region: "americas", scale: 5,
    note: h.note + " Focus: " + h.focus,
    source: h.source, updated: "mid-2026"
  };
}


// ---- Flow arcs -------------------------------------------------------------------
function addFlowLayers() {
  const lines = {
    type: "FeatureCollection",
    features: FLOW_PATHS.map((f) => ({
      type: "Feature",
      geometry: { type: "LineString", coordinates: f.path },
      properties: { name: f.name, color: f.color, category: "flow", subtype: "Supply-chain flow", status: "—", statusClass: "other" }
    }))
  };
  map.addSource("flows", { type: "geojson", data: lines });
  map.addLayer({
    id: "flows-base", type: "line", source: "flows",
    layout: { "line-cap": "round" },
    paint: { "line-color": COLOR_MATCH, "line-width": 1, "line-opacity": 0.16 }
  });
  map.addLayer({
    id: "flows-dash", type: "line", source: "flows",
    layout: { "line-cap": "round" },
    paint: { "line-color": COLOR_MATCH, "line-width": 1.5, "line-opacity": 0.55, "line-dasharray": [0, 4, 3] }
  });

  map.addSource("flow-particles", { type: "geojson", data: emptyFC() });
  map.addLayer({
    id: "flow-particles", type: "circle", source: "flow-particles",
    paint: { "circle-radius": 3, "circle-color": COLOR_MATCH, "circle-blur": 0.4, "circle-opacity": 0.95 }
  });
}


// ---- Point + line layers ------------------------------------------------------------
function addPointLayer(id, geojson, opts = {}) {
  if (map.getSource(id)) { map.getSource(id).setData(geojson); return; }
  map.addSource(id, { type: "geojson", data: geojson });

  map.addLayer({
    id: id + "-glow", type: "circle", source: id,
    paint: {
      // Wide, fully-blurred halo. With the rings gone this outer cloud is most
      // of what you actually see, so it runs larger and softer than before.
      "circle-radius": opts.small ? 12 : ["*", 3.0, RADIUS_EXPR],
      "circle-color": COLOR_MATCH,
      "circle-blur": 1,
      "circle-opacity": 0.30
    }
  });
  map.addLayer({
    id, type: "circle", source: id,
    paint: {
      "circle-radius": opts.small ? 4.2 : ["*", 1.3, RADIUS_EXPR],
      "circle-color": COLOR_MATCH,
      "circle-opacity": FILL_OPACITY_EXPR,
      "circle-blur": FILL_BLUR_EXPR,
      "circle-stroke-width": STROKE_WIDTH_EXPR
    }
  });
}

function addLineLayer(id, geojson) {
  map.addSource(id, { type: "geojson", data: geojson });
  map.addLayer({
    id: id + "-glow", type: "line", source: id,
    layout: { "line-cap": "round" },
    paint: { "line-color": COLOR_MATCH, "line-width": 6, "line-opacity": 0.1, "line-blur": 4 }
  });
  map.addLayer({
    id, type: "line", source: id,
    layout: { "line-cap": "round" },
    paint: {
      "line-color": COLOR_MATCH,
      "line-width": 2.4,
      "line-opacity": ["match", ["get", "statusClass"], "planned", 0.45, 0.85]
    }
  });
  map.addLayer({
    id: id + "-dash", type: "line", source: id,
    layout: { "line-cap": "round" },
    paint: { "line-color": "#dfe9f5", "line-width": 1.2, "line-opacity": 0.42, "line-dasharray": [0, 4, 3] }
  });
}

function addSelectionLayer() {
  map.addSource("selection", { type: "geojson", data: emptyFC() });
  map.addLayer({
    id: "selection-ring", type: "circle", source: "selection",
    paint: {
      "circle-radius": 15,
      "circle-color": "rgba(0,0,0,0)",
      "circle-stroke-width": 1.8,
      "circle-stroke-color": "#ffffff",
      "circle-opacity": 0.9
    }
  });
}

function emptyFC() { return { type: "FeatureCollection", features: [] }; }
