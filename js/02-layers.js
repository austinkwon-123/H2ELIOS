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
  if (opts.pulse) pulseLayers.push(id + "-glow");
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
      "circle-opacity": 0
    }
  });
}

function emptyFC() { return { type: "FeatureCollection", features: [] }; }


// ---- Animations -----------------------------------------------------------------------
const pulseLayers = [];
const DASH_SEQ = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5],
  [3, 4, 0], [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5]
];

function startAnimations() {
  let dashStep = 0, lastDash = 0;
  const t0 = performance.now();

  function frame(now) {
    if (now - lastDash > 70) {
      dashStep = (dashStep + 1) % DASH_SEQ.length;
      const dash = DASH_SEQ[dashStep];
      if (map.getLayer("pipelines-dash")) map.setPaintProperty("pipelines-dash", "line-dasharray", dash);
      if (map.getLayer("flows-dash")) map.setPaintProperty("flows-dash", "line-dasharray", dash);
      lastDash = now;
    }

    const s = (Math.sin((now - t0) / 550) + 1) / 2;
    pulseLayers.forEach((id) => {
      if (!map.getLayer(id)) return;
      map.setPaintProperty(id, "circle-opacity", 0.1 + s * 0.16);
    });

    // Subtle shimmer on the network web
    if (map.getLayer("web")) {
      const w = (Math.sin((now - t0) / 1800) + 1) / 2;
      map.setPaintProperty("web", "line-opacity", 0.1 + w * 0.09);
    }

    if (map.getSource("flow-particles")) {
      const feats = [];
      FLOW_PATHS.forEach((f, i) => {
        const t = ((now / 3200) + i * 0.31) % 1;
        const idx = t * (f.path.length - 1);
        const lo = Math.floor(idx), hi = Math.min(lo + 1, f.path.length - 1), frac = idx - lo;
        const p = f.path[lo], q = f.path[hi];
        feats.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [p[0] + (q[0] - p[0]) * frac, p[1] + (q[1] - p[1]) * frac] },
          properties: { color: f.color }
        });
      });
      map.getSource("flow-particles").setData({ type: "FeatureCollection", features: feats });
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
