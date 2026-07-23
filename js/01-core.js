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


// ---- Base style: shared "Command Center" dark basemap -----------------------
// Hoisted to its own constant (rather than inlined in the map init below) so
// other views that want the same basemap - e.g. the Macro Flow cinematic
// view's secondary MapLibre instance (20-macro-flow.js) - can reuse this
// exact definition instead of either duplicating it or calling
// map.getStyle() on the live map, which would also snapshot every
// dynamically-added runtime layer (satellites, comet arcs, API project
// circles/extrusions, their current data payloads, etc.) into what's
// supposed to be a clean minimal backdrop.
const H2GRID_BASE_STYLE = {
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
      },
      "nasa-night-lights": {
        type: "raster",
        tiles: ["https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_CityLights_2012/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpg"],
        tileSize: 256,
        maxzoom: 8, // GIBS's GoogleMapsCompatible_Level8 matrix set stops at z8 - MapLibre upsamples past that rather than 404ing per tile
        attribution: "NASA EOSDIS GIBS / VIIRS Earth at Night 2012 (Black Marble)"
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
        paint: { "fill-color": "#0b132b", "fill-opacity": 0.6 } // Command Center "Earth Mass"
      },
      {
        // NASA Black Marble city lights - sits above the land-fill tint (not
        // dimmed by its 0.6 fill-opacity) but below coast-glow/coast and
        // every data/extrusion/custom-WebGL layer added later via
        // map.addLayer() elsewhere, since those append to the end of the
        // layer stack by default. raster-saturation pulled down and
        // raster-contrast pushed up so city-light clusters read as muted
        // amber texture rather than competing with the neon #00F0FF spikes.
        id: "night-lights", type: "raster", source: "nasa-night-lights",
        paint: {
          // Altitude fade: full city-light texture at orbital zooms, smoothly
          // gone by ground level - GIBS's tiles top out at z8 (see maxzoom
          // above) and upsample past that, so fading them out before the
          // upsampling gets visually obvious also sidesteps pixelation.
          "raster-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.7, 6, 0],
          "raster-contrast": 0.15,
          "raster-saturation": -0.15,
          "raster-brightness-max": 0.85
        }
      },
      {
        id: "coast-glow", type: "line", source: "boundaries", "source-layer": "countries",
        // Zoom-tied so the globe's edge-glow shares the same 3->6 orbital->ground
        // fade schedule as the starfield (07-live.js) and atmosphere-blend below,
        // rather than sitting at a flat opacity regardless of zoom.
        paint: {
          "line-color": "#00f0ff", "line-width": 2.6, "line-blur": 3, // Command Center energy accent
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.32, 3, 0.32, 6, 0.15, 9, 0.15]
        }
      },
      {
        id: "coast", type: "line", source: "boundaries", "source-layer": "countries",
        paint: { "line-color": "#7fe6f2", "line-width": 0.7, "line-opacity": 0.55 }
      }
    ],
    sky: {
      "sky-color": "#040914",
      "horizon-color": "#1d3247",
      "fog-color": "#02040a",
      "sky-horizon-blend": 0.6,
      "horizon-fog-blend": 0.6,
      "fog-ground-blend": 0.85,
      // Shares the 3->6 orbital->ground fade schedule with the starfield
      // (--bg-fx in 07-live.js) and coast-glow above, so the whole space-view
      // transition reads as one effect.
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.75, 3, 0.75, 6, 0.08, 9, 0]
    },
    glyphs: "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf"
};

// ---- Map init: 3D globe ----------------------------------------------------
const map = new maplibregl.Map({
  container: "map",
  style: H2GRID_BASE_STYLE,
  center: [15, 20],
  zoom: 1.7,
  pitch: 58,
  bearing: 12,
  minZoom: 1.0,
  maxZoom: 16,
  maxPitch: 70, // default maxPitch is 60, which would clamp the click fly-to's target pitch of 65
  attributionControl: false
});

map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: false }), "top-left");

class ResetViewControl {
  onAdd(mapRef) {
    this._map = mapRef;
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";
    const btn = document.createElement("button");
    btn.className = "has-tip tip-right";
    btn.type = "button";
    btn.setAttribute("aria-label", "Reset view");
    btn.setAttribute("data-tip", "Reset view");
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" style="stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>';
    btn.onclick = () => mapRef.flyTo({ center: [15, 20], zoom: 1.7, pitch: 58, bearing: 12, duration: 1200 });
    this._container.appendChild(btn);
    return this._container;
  }
  onRemove() { this._container.remove(); this._map = undefined; }
}
map.addControl(new ResetViewControl(), "top-left");


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
  wireFlyouts();
  wireSearch();
  wireSearchHotkey();
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
      "sky-color": "#040914",
      "horizon-color": "#1f5a70",
      "fog-color": "#03070f",
      "sky-horizon-blend": 0.5,
      "horizon-fog-blend": 0.5,
      "fog-ground-blend": 0.8,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.9, 3, 0.9, 6, 0.12, 9, 0]
    } : {
      "sky-color": "#eaf1f9",
      "horizon-color": "#c8d6e8",
      "fog-color": "#e2eaf4",
      "sky-horizon-blend": 0.7,
      "horizon-fog-blend": 0.7,
      "fog-ground-blend": 0.9,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 3, 0.5, 6, 0.06, 9, 0]
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
