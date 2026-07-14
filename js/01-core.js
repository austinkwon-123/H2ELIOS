/* ==========================================================================
   H2Grid · Core engine
   Config, tokens, map/globe init, state, geometry, utils, load orchestrator, theme, spin.
   Browser classic scripts share one global lexical scope, so map, helpers &
   state from core are visible here. Load order matters — see index.html.
   ======================================================================= */

// H₂Grid — app.js (v5)
// The global hydrogen network as a rotating 3D GLOBE (MapLibre GL v5 globe
// projection) wrapped in Liquid Glass 2.0 UI with dark & light themes.
// Carries over v4: five regions, gigafactories, contracted corridors,
// capacity-scaled markers, status-differentiated styling, intel ticker.

// ---- Config -----------------------------------------------------------
// Free key from https://developer.nrel.gov/signup/ — DEMO_KEY works but is
// rate-limited (30 req/hr, 50/day) and shared across every DEMO_KEY user.
const NREL_API_KEY = "DEMO_KEY";
const AFDC_URL = `https://developer.nrel.gov/api/alt-fuel-stations/v1.json?fuel_type=HY&api_key=${NREL_API_KEY}&limit=200`;

const COLORS = {
  green: "#34d399",
  blue: "#60a5fa",
  pink: "#f472b6",
  turquoise: "#2dd4bf",
  gray_blue: "#94a3b8",
  gray: "#94a3b8",
  brown: "#b45309",
  mfg: "#a78bfa"
};

const COLOR_MATCH = [
  "match", ["get", "color"],
  "green", COLORS.green,
  "blue", COLORS.blue,
  "pink", COLORS.pink,
  "turquoise", COLORS.turquoise,
  "gray_blue", COLORS.gray_blue,
  "brown", COLORS.brown,
  "mfg", COLORS.mfg,
  /* default */ "#9ca3af"
];

// Capacity-scaled radius: base + scale tier (1–8).
const RADIUS_EXPR = ["+", 2.5, ["*", 1.1, ["coalesce", ["get", "scale"], 2]]];
const GLOW_RADIUS_EXPR = ["*", 2.6, RADIUS_EXPR];

// Status-differentiated styling: operating = solid; construction = white ring;
// planned = hollow (faint fill, colored ring); at-risk = red ring.
const FILL_OPACITY_EXPR = [
  "match", ["get", "statusClass"],
  "planned", 0.14,
  "atrisk", 0.55,
  /* default */ 0.92
];
const STROKE_COLOR_EXPR = [
  "match", ["get", "statusClass"],
  "construction", "#ffffff",
  "planned", COLOR_MATCH,
  "atrisk", "#f87171",
  /* default */ "#01030a"
];
const STROKE_WIDTH_EXPR = [
  "match", ["get", "statusClass"],
  "construction", 1.6,
  "planned", 1.6,
  "atrisk", 1.8,
  /* default */ 1.2
];

const D = window.HYDROGEN_DATA;


// ---- Map init: 3D globe ----------------------------------------------------
const map = new maplibregl.Map({
  container: "map",
  style: {
    version: 8,
    projection: { type: "globe" },
    sources: {
      "carto-dark": {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png",
          "https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png",
          "https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}@2x.png"
        ],
        tileSize: 256,
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
      },
      "carto-light": {
        type: "raster",
        tiles: [
          "https://a.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png",
          "https://b.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png",
          "https://c.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}@2x.png"
        ],
        tileSize: 256,
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
      },
      "boundaries": {
        type: "vector",
        url: "https://demotiles.maplibre.org/tiles/tiles.json"
      }
    },
    layers: [
      {
        id: "basemap-dark", type: "raster", source: "carto-dark",
        paint: { "raster-brightness-max": 0.5, "raster-contrast": 0.2, "raster-saturation": -0.6, "raster-opacity": 0.3 }
      },
      {
        id: "basemap-light", type: "raster", source: "carto-light",
        layout: { visibility: "none" },
        paint: { "raster-saturation": -0.15 }
      },
      {
        id: "land-fill", type: "fill", source: "boundaries", "source-layer": "countries",
        paint: { "fill-color": "#0a1826", "fill-opacity": 0.55 }
      },
      {
        id: "coast-glow", type: "line", source: "boundaries", "source-layer": "countries",
        paint: { "line-color": "#3fd6e8", "line-width": 2.6, "line-blur": 3, "line-opacity": 0.2 }
      },
      {
        id: "coast", type: "line", source: "boundaries", "source-layer": "countries",
        paint: { "line-color": "#7fe6f2", "line-width": 0.7, "line-opacity": 0.55 }
      }
    ],
    sky: {
      "sky-color": "#02040a",
      "horizon-color": "#1d3247",
      "fog-color": "#02040a",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.85,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.7, 6, 0.15, 8, 0]
    },
    glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf"
  },
  center: [15, 20],
  zoom: 1.7,
  minZoom: 1.0,
  maxZoom: 16,
  attributionControl: false
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: false }), "top-left");


// ---- State ---------------------------------------------------------------
let statusFilter = "all";     // all | operating | construction | planned | atrisk
let regionFilter = "all";     // all | americas | europe | mena | apac
let colorFilter = null;       // null | taxonomy color key
let selectedName = null;
let spinning = true;          // idle globe rotation until first interaction
const hoverPopup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });


// ---- Geometry helpers ------------------------------------------------------
function circlePolygon(center, radiusKm, points = 64) {
  const coords = [];
  const distX = radiusKm / (111.32 * Math.cos((center[1] * Math.PI) / 180));
  const distY = radiusKm / 110.574;
  for (let i = 0; i <= points; i++) {
    const theta = (i / points) * (2 * Math.PI);
    coords.push([center[0] + distX * Math.cos(theta), center[1] + distY * Math.sin(theta)]);
  }
  return { type: "Polygon", coordinates: [coords] };
}

function arcCoords(from, to, bow = 0.22, steps = 60) {
  const mx = (from[0] + to[0]) / 2, my = (from[1] + to[1]) / 2;
  const dx = to[0] - from[0], dy = to[1] - from[1];
  const cx = mx - dy * bow, cy = my + dx * bow;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, u = 1 - t;
    pts.push([u * u * from[0] + 2 * u * t * cx + t * t * to[0],
              u * u * from[1] + 2 * u * t * cy + t * t * to[1]]);
  }
  return pts;
}

const FLOW_PATHS = D.flows.map((f) => ({ ...f, path: arcCoords(f.from, f.to) }));

function kmDist(a, b) {
  const dx = (a[0] - b[0]) * 111.32 * Math.cos(((a[1] + b[1]) / 2) * Math.PI / 180);
  const dy = (a[1] - b[1]) * 110.574;
  return Math.sqrt(dx * dx + dy * dy);
}

// Illustrative network web: connect every point facility to its k nearest
// neighbors within maxKm. Pure visual layer (labeled illustrative in UI).
function buildNetworkWeb(k = 3, maxKm = 2200) {
  const nodes = [];
  ["upstream", "production", "manufacturing", "storagePoints", "endUse", "fuelingStationsFallback"].forEach((key) => {
    (D[key] ? D[key].features : []).forEach((f) => nodes.push({ c: f.geometry.coordinates, color: f.properties.color }));
  });
  const seen = new Set();
  const features = [];
  nodes.forEach((n, i) => {
    const dists = nodes
      .map((m, j) => ({ j, d: i === j ? Infinity : kmDist(n.c, m.c) }))
      .filter((x) => x.d < maxKm)
      .sort((a, b) => a.d - b.d)
      .slice(0, k);
    dists.forEach(({ j }) => {
      const id = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(id)) return;
      seen.add(id);
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates: [n.c, nodes[j].c] },
        properties: { color: n.color }
      });
    });
  });
  return { type: "FeatureCollection", features };
}


// ---- Build layers on load ---------------------------------------------------
map.on("load", () => {
  addWebLayer();
  addHubLayers();
  addFlowLayers();
  addLineLayer("pipelines", D.pipelines);
  addPointLayer("upstream", D.upstream);
  addPointLayer("production", D.production, { pulse: true });
  addPointLayer("manufacturing", D.manufacturing);
  addPointLayer("storage", D.storagePoints);
  addPointLayer("endUse", D.endUse);
  addPointLayer("fuelingStations", D.fuelingStationsFallback, { small: true });
  addSelectionLayer();

  setStatus("fallback", "Cached stations");
  loadLiveStations();

  wireDock();
  wireSegments();
  wireLegend();
  wireSearch();
  wireClicks();
  wireDetailClose();
  wireTour();
  wireTheme();
  startTicker();

  renderStats();
  startAnimations();
  startSpin();
});


// ---- Theme (dark / light Liquid Glass) ----------------------------------------
function currentTheme() {
  return document.body.classList.contains("light") ? "light" : "dark";
}

function setTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  const dark = theme !== "light";

  if (map.getLayer && map.getLayer("basemap-dark")) {
    map.setLayoutProperty("basemap-dark", "visibility", dark ? "visible" : "none");
    map.setLayoutProperty("basemap-light", "visibility", dark ? "none" : "visible");
  }
  if (map.getLayer && map.getLayer("hub-labels")) {
    map.setPaintProperty("hub-labels", "text-halo-color", dark ? "#01030a" : "#f4f7fc");
    map.setPaintProperty("hub-labels", "text-color",
      ["case", ["==", ["get", "funding"], "terminated"], dark ? "#fca5a5" : "#b91c1c", dark ? "#6ee7c5" : "#047857"]);
  }
  if (map.getLayer && map.getLayer("pipelines-dash")) {
    map.setPaintProperty("pipelines-dash", "line-color", dark ? "#eef3fc" : "#22314d");
  }
  if (map.getLayer && map.getLayer("selection-ring")) {
    map.setPaintProperty("selection-ring", "circle-stroke-color", dark ? "#ffffff" : "#17202f");
  }
  if (typeof map.setSky === "function") {
    map.setSky(dark ? {
      "sky-color": "#02040a",
      "horizon-color": "#1f5a70",
      "fog-color": "#03070f",
      "sky-horizon-blend": 0.5,
      "horizon-fog-blend": 0.5,
      "fog-ground-blend": 0.8,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.9, 6, 0.22, 8, 0]
    } : {
      "sky-color": "#eaf1f9",
      "horizon-color": "#c8d6e8",
      "fog-color": "#e2eaf4",
      "sky-horizon-blend": 0.7,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.9,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 6, 0.1, 8, 0]
    });
  }
  try { localStorage.setItem("h2grid-theme", theme); } catch (e) { /* ignore */ }
}

function wireTheme() {
  // v7: single mission-control theme. Force dark; toggle retired.
  setTheme("dark");
  const btn = document.getElementById("theme-btn");
  if (btn) btn.style.display = "none";
}


// ---- Idle globe rotation ---------------------------------------------------------
function startSpin() {
  const stop = () => { spinning = false; };
  ["mousedown", "wheel", "touchstart", "dragstart"].forEach((ev) => map.on(ev, stop));
  map.on("moveend", () => { if (spinning) spinStep(); });
  spinStep();
}

function spinStep() {
  if (!spinning) return;
  if (map.getZoom && map.getZoom() > 3.5) return;
  const c = map.getCenter ? map.getCenter() : { lng: 15, lat: 20 };
  map.easeTo({ center: [c.lng + 10, c.lat], duration: 8000, easing: (n) => n });
}

function stopSpin() { spinning = false; }


// ---- Utils --------------------------------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}
