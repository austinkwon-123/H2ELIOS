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
// capacity-scaled markers, status-differentiated styling.

// ---- Config -----------------------------------------------------------
// Free key from https://developer.nrel.gov/signup/ — DEMO_KEY works but is
// rate-limited (30 req/hr, 50/day) and shared across every DEMO_KEY user.
// Override in js/config.js (gitignored) rather than editing this line.
const NREL_API_KEY = (window.H2G_CONFIG && window.H2G_CONFIG.NREL_API_KEY) || "DEMO_KEY";
const AFDC_URL = `https://developer.nrel.gov/api/alt-fuel-stations/v1.json?fuel_type=HY&api_key=${NREL_API_KEY}&limit=200`;

// The shell must never imply that every visible record is live merely because
// the application itself is online. Each connected feed reports its own state;
// the compact ribbon indicator then describes the aggregate honestly while the
// curated/cached baseline keeps the product usable during an outage.
const H2ELIOS_DATA_HEALTH = Object.create(null);
window.H2ELIOSReportDataHealth = function (feed, state) {
  H2ELIOS_DATA_HEALTH[feed] = state;
  const indicator = document.querySelector(".freshness-indicator");

  const states = Object.values(H2ELIOS_DATA_HEALTH);
  const hasLive = states.includes("live");
  const hasFallback = states.includes("cached") || states.includes("degraded");
  const hasChecking = states.includes("checking");
  let aggregate = "checking";
  let label = "Checking data";
  let title = "Checking connected data services";

  if (hasFallback && hasLive) {
    aggregate = "mixed";
    label = "Live + cached";
    title = "Some connected feeds are live; unavailable feeds use cached or curated data";
  } else if (hasFallback) {
    aggregate = "cached";
    label = "Cached snapshot";
    title = "Live services are unavailable; showing cached and curated data";
  } else if (hasLive && !hasChecking) {
    aggregate = "live";
    label = "Live data";
    title = "Connected data services are responding";
  } else if (hasLive) {
    aggregate = "mixed";
    label = "Live + checking";
    title = "At least one feed is live; remaining services are still being checked";
  }

  if (indicator) {
    indicator.dataset.state = aggregate;
    indicator.title = title;
    const copy = indicator.querySelector(".freshness-copy");
    if (copy) copy.textContent = label;
  }

  const sidebarFooter = document.querySelector(".sidebar-footer");
  const sidebarLabel = document.getElementById("sidebar-status-label");
  if (sidebarFooter) {
    sidebarFooter.dataset.state = aggregate;
    sidebarFooter.title = title;
  }
  if (sidebarLabel) {
    sidebarLabel.textContent = aggregate === "live" ? "Live network" :
      aggregate === "mixed" ? "Mixed data sources" :
      aggregate === "cached" ? "Cached network" : "Checking data";
  }

  if (feed === "stations") {
    const stationButton = document.querySelector('[data-layer="fuelingStations"]');
    if (stationButton) {
      const stationLabel = state === "live" ? "Fueling stations (live)" :
        state === "checking" ? "Fueling stations (checking live feed)" :
        "Fueling stations (cached snapshot)";
      stationButton.dataset.feedState = state;
      stationButton.setAttribute("aria-label", stationLabel);
      stationButton.setAttribute("data-tip", stationLabel);
    }
  }

  if (feed === "projects") {
    const apiButton = document.querySelector('[data-layer="apiLive"]');
    if (apiButton) {
      const isLive = state === "live";
      const apiLabel = isLive ? "Live API project tier" :
        state === "checking" ? "Live API project tier (checking)" :
        "Live API unavailable — cached IEA projects remain available";
      apiButton.dataset.feedState = state;
      apiButton.disabled = !isLive;
      apiButton.setAttribute("aria-disabled", String(!isLive));
      apiButton.setAttribute("aria-label", apiLabel);
      apiButton.setAttribute("data-tip", apiLabel);
    }
  }
};

["projects", "analytics", "stations"].forEach((feed) => {
  window.H2ELIOSReportDataHealth(feed, "checking");
});
// Do not leave the interface claiming that a connection is still being
// checked forever. A late response can still promote the feed to live later.
setTimeout(() => {
  Object.entries(H2ELIOS_DATA_HEALTH).forEach(([feed, state]) => {
    if (state === "checking") window.H2ELIOSReportDataHealth(feed, "degraded");
  });
}, 7000);

// Ambient motion is animation that runs without user action and does not
// explain a change in the data — as opposed to a loading indicator, a value
// updating, or a transition the user just triggered, all of which stay on.
//
// Off by default. The two loops this gates (orbiting satellites and the
// comet-pulse hub arcs, both in 18-api-live.js) are synthetic, and the arcs
// additionally draw routes that are not real contracted supply chains while
// rendering on the same globe as real project data. Flip to true to restore.
const H2ELIOS_AMBIENT_MOTION = false;

// The stylesheet already honours prefers-reduced-motion for CSS animation and
// transitions, but that media query cannot reach requestAnimationFrame loops.
const H2ELIOS_REDUCED_MOTION = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

function ambientMotionAllowed() {
  return H2ELIOS_AMBIENT_MOTION && !H2ELIOS_REDUCED_MOTION;
}

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

// Daylight map marks need pigment, not emission. These are deliberately
// darker companions to the night palette so categories remain consistent
// while lines and points keep enough contrast on pale land and ocean tiles.
const LIGHT_COLORS = {
  green: "#087a55",
  blue: "#245db5",
  pink: "#ad326e",
  turquoise: "#0b7480",
  gray_blue: "#52657a",
  brown: "#8a4c08",
  mfg: "#6243a8"
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

const LIGHT_COLOR_MATCH = [
  "match", ["get", "color"],
  "green", LIGHT_COLORS.green,
  "blue", LIGHT_COLORS.blue,
  "pink", LIGHT_COLORS.pink,
  "turquoise", LIGHT_COLORS.turquoise,
  "gray_blue", LIGHT_COLORS.gray_blue,
  "brown", LIGHT_COLORS.brown,
  "mfg", LIGHT_COLORS.mfg,
  /* default */ "#52657a"
];

// Capacity-scaled radius: base + scale tier (1–8).
const RADIUS_EXPR = ["+", 2.5, ["*", 1.1, ["coalesce", ["get", "scale"], 2]]];
const GLOW_RADIUS_EXPR = ["*", 2.6, RADIUS_EXPR];

// Status-differentiated styling. The disc is deliberately translucent and the
// ring carries the weight: against this dark basemap an opaque fill reads as a
// flat paint dot, while a low fill under a luminous rim reads as glass and lets
// overlapping facilities stay legible instead of occluding each other.
// Status stays encoded by ring treatment: operating = colored rim;
// construction = white ring; planned = near-hollow; at-risk = red ring.
// Rings removed entirely — markers are soft luminous clouds with no hard edge.
// Status is now carried by fill weight alone (operating densest, planned
// faintest) instead of by ring colour, so the encoding survives without the
// crisp outline. At-risk keeps its red via STROKE-free colour handling in the
// glow layer; see addPointLayer in 02-layers.js.
// Opacity has to stay high enough for HUE to survive. Very low alpha over a
// dark basemap desaturates toward grey, and the whole point of these colours
// is telling green / blue / pink / turquoise hydrogen apart at a glance —
// at 0.24 they were all reading as the same pale smudge.
const FILL_OPACITY_EXPR = [
  "match", ["get", "statusClass"],
  "planned", 0.20,
  "atrisk", 0.42,
  "construction", 0.56,
  /* default */ 0.58
];
// Blur is what makes the marker read as cloud rather than disc. Pulled back
// from 0.85: past ~0.7 the colour smears out so far it greys off entirely.
const FILL_BLUR_EXPR = [
  "match", ["get", "statusClass"],
  "planned", 0.75,
  /* default */ 0.6
];
const STROKE_WIDTH_EXPR = 0;

const D = window.HYDROGEN_DATA;

// Capacity is stored in MW throughout, but announced hydrogen projects span
// roughly 1 MW to several million, so a single fixed unit is either unreadable
// ("801,958 MW") or absurd ("0.000001 TW"). Pick the unit that keeps the
// number in a human range and return the parts, so callers that animate a
// value (the odometer) can scale the number and set the suffix separately.
function formatCapacity(mw) {
  const n = Number(mw) || 0;
  const abs = Math.abs(n);
  if (abs >= 1e6) return { value: n / 1e6, unit: "TW", decimals: 2 };
  if (abs >= 1000) return { value: n / 1000, unit: "GW", decimals: abs >= 1e5 ? 0 : 1 };
  return { value: n, unit: "MW", decimals: 0 };
}

function capacityText(mw) {
  const f = formatCapacity(mw);
  return `${f.value.toLocaleString(undefined, { minimumFractionDigits: f.decimals, maximumFractionDigits: f.decimals })} ${f.unit}`;
}


// ---- Base style: shared "Command Center" dark basemap -----------------------
// Hoisted to its own constant (rather than inlined in the map init below) so
// any future view wanting the same basemap can reuse this exact definition
// instead of either duplicating it or calling map.getStyle() on the live
// map, which would also snapshot every dynamically-added runtime layer
// (satellites, comet arcs, API project circles/extrusions, their current
// data payloads, etc.) into what's supposed to be a clean minimal backdrop.
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
const H2GRID_HOME_VIEW = {
  center: [24, 8],
  zoom: 1.85,
  pitch: 0,
  bearing: 8
};

const map = new maplibregl.Map({
  container: "map",
  style: H2GRID_BASE_STYLE,
  ...H2GRID_HOME_VIEW,
  minZoom: 1.0,
  maxZoom: 16,
  maxPitch: 70, // default maxPitch is 60, which would clamp the click fly-to's target pitch of 65
  attributionControl: false
});
// A stable, read-only integration handle for shell coordination and visual
// regression checks. The classic-script lexical `map` binding remains the
// implementation source of truth.
window.H2ELIOS_MAP = map;

// Zoom in/out + reset view, one custom control instead of MapLibre's stock
// NavigationControl (plain white 29px squares) — built the same way as the
// old ResetViewControl below, just with two more buttons and a divider, so
// all three share the app's own floating round-pill look (see .map-zoom-btn
// in style.css) rather than the library's unstyled default chrome.
class MapControlCluster {
  onAdd(mapRef) {
    this._map = mapRef;
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group map-zoom-cluster";
    const mkBtn = (label, svg, onClick) => {
      const btn = document.createElement("button");
      btn.className = "map-zoom-btn has-tip tip-right";
      btn.type = "button";
      btn.setAttribute("aria-label", label);
      btn.setAttribute("data-tip", label);
      btn.innerHTML = svg;
      btn.onclick = onClick;
      return btn;
    };
    const zoomIn = mkBtn("Zoom in", '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>', () => mapRef.zoomIn());
    const zoomOut = mkBtn("Zoom out", '<svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg>', () => mapRef.zoomOut());
    const sep = document.createElement("div");
    sep.className = "dock-sep";
    const reset = mkBtn("Reset view", '<svg viewBox="0 0 24 24"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>', () => mapRef.flyTo({ ...H2GRID_HOME_VIEW, duration: 1200 }));
    this._container.append(zoomIn, zoomOut, sep, reset);
    return this._container;
  }
  onRemove() { this._container.remove(); this._map = undefined; }
}
map.addControl(new MapControlCluster(), "top-left");

// Switching between right-panel-slot panels (a project's detail, the AI
// regional overview, Markets) used to fully CLOSE whichever one was open —
// so opening Markets while a project was selected just discarded it.
// detail-card and regional-ai-panel now minimize instead, same as clicking
// their own Minimize dot would: nothing already open is lost, only closed
// explicitly. detail-card minimizes via the same real snapshot mechanism its
// own dot uses (needs lastDetailProps, set in js/05-detail.js's
// showDetail()); regional-ai-panel uses the plain chip minimize since it's
// single-instance app state, not a per-object record. Markets is NOT a
// minimize candidate — it's a live ticker with its own polling interval
// (stopMarketsPolling()), not a snapshot of anything worth restoring, so
// switching away from it just closes it outright via its real close
// function, same as clicking its own Close would.
function closeOtherRightPanels(exceptId) {
  const minimizers = {
    "detail-card": (el) => { if (typeof lastDetailProps !== "undefined" && lastDetailProps) minimizeDetailPanel(lastDetailProps, null, el); else closeDetailPanel(); },
    "regional-ai-panel": () => minimizePanel("regional-ai-panel", "AI Regional Overview"),
    "analytics-panel": () => { if (typeof closeAnalyticsPanel === "function") closeAnalyticsPanel(); },
    "markets-panel": () => closeMarketsPanel(),
    "geology-panel": () => { const panel = document.getElementById("geology-panel"); if (panel) panel.hidden = true; }
  };
  Object.entries(minimizers).forEach(([id, minimize]) => {
    if (id !== exceptId) {
      const el = document.getElementById(id);
      if (el && !el.hidden) minimize(el);
    }
  });
}

// ---- Minimize-to-tray -----------------------------------------------------
// A panel's Minimize dot sends it to the bottom of the screen instead of
// closing it outright.
//
// Two different shapes, because two different things are being minimized:
//
//   - Simple panels (analytics/markets/AI) are single-instance app state —
//     there's only ever one, so minimizing is a plain hide/show toggle onto
//     a text chip (minimizePanel()).
//
//   - #detail-card is a per-object record, and the whole point of
//     minimizing one is to open ANOTHER project and compare them — so it
//     minimizes to a quarter-size mini-card carrying real content (name,
//     status, capacity), not a text label, and its own green "enlarge" dot
//     is real: tap it and the full panel reappears on the right, at which
//     point ITS Minimize dot sends it right back to a mini-card. Built from
//     the STORED properties object via buildDetailHTML() (js/05-detail.js),
//     not by cloning the live panel's DOM — the live panel may already be
//     showing a different project by the time this fires.
function ensureMinimizedTray() {
  let tray = document.getElementById("minimized-tray");
  if (!tray) {
    tray = document.createElement("div");
    tray.id = "minimized-tray";
    document.body.appendChild(tray);
  }
  return tray;
}
function ensureSnapshotRow() {
  let row = document.getElementById("snapshot-row");
  if (!row) {
    row = document.createElement("div");
    row.id = "snapshot-row";
    document.body.appendChild(row);
  }
  return row;
}
function removeMinimizedChip(panelId) {
  const chip = document.getElementById("min-chip-" + panelId);
  if (chip) chip.remove();
}

// #snapshot-row and the live right-panel-slot (#detail-card /
// #regional-ai-panel / #markets-panel) both anchor to the same top:74px;
// right:14px corner — fine when only one is ever visible at a time, but
// comparison snapshots are explicitly meant to stay open WHILE a new
// project is selected, so both can now be on screen together and land
// exactly on top of each other. Nudge the row left, out from under the
// live panel's 400px width, whenever one is actually showing. A
// MutationObserver rather than editing every call site that shows/hides
// these three panels (spread across 01-core.js, 05-detail.js,
// 16-ai-features.js, 03-filters.js) — it reacts to the `hidden` attribute
// changing no matter which of those set it.
function updateSnapshotRowOffset() {
  const row = document.getElementById("snapshot-row");
  if (!row) return;
  const livePanelOpen = ["detail-card", "regional-ai-panel", "markets-panel"]
    .some((id) => { const el = document.getElementById(id); return el && !el.hidden; });
  row.style.right = livePanelOpen ? "428px" : "";
}
(function watchRightPanelSlots() {
  const ids = ["detail-card", "regional-ai-panel", "markets-panel"];
  const observer = new MutationObserver(updateSnapshotRowOffset);
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el, { attributes: true, attributeFilter: ["hidden"] });
  });
})();

// FLIP transition: animates `el` (already in its FINAL position in the DOM)
// growing/shrinking out of `fromRect` instead of just popping into existence
// mid-screen. This is what makes minimize <-> restore read as one continuous
// object moving, rather than two unrelated panels swapping — the exact
// "doesn't integrate well" gap between the mini-card and the full panel.
function flipIn(el, fromRect) {
  if (!fromRect || !fromRect.width || !fromRect.height) return;
  const toRect = el.getBoundingClientRect();
  const dx = (fromRect.left + fromRect.width / 2) - (toRect.left + toRect.width / 2);
  const dy = (fromRect.top + fromRect.height / 2) - (toRect.top + toRect.height / 2);
  const sx = Math.max(0.001, fromRect.width / toRect.width);
  const sy = Math.max(0.001, fromRect.height / toRect.height);
  el.style.transition = "none";
  el.style.opacity = "0";
  el.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = "transform 0.38s var(--motion-spring), opacity 0.24s ease";
      el.style.opacity = "1";
      el.style.transform = "none";
    });
  });
  el.addEventListener("transitionend", () => { el.style.transition = ""; el.style.transform = ""; el.style.opacity = ""; }, { once: true });
}
function minimizePanel(panelId, label) {
  const panel = document.getElementById(panelId);
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  if (document.getElementById("min-chip-" + panelId)) return;
  const chip = document.createElement("button");
  chip.id = "min-chip-" + panelId;
  chip.className = "min-chip";
  chip.type = "button";
  chip.title = "Restore " + label;
  chip.innerHTML = `<span class="wc-dot wc-min" aria-hidden="true"></span><span>${label}</span>`;
  chip.addEventListener("click", () => { chip.remove(); panel.hidden = false; });
  ensureMinimizedTray().appendChild(chip);
}

let snapshotSeq = 0;

// Comparison cap: at most 3 full snapshot panels open on the right at once —
// beyond that they'd crowd the screen and stop being a readable comparison.
// Tracked in insertion order so a 4th arrival bumps the OLDEST one back to a
// mini-card automatically (nothing is lost, it just steps aside), rather
// than silently refusing to open or blocking the new one.
const MAX_SNAPSHOTS = 3;
const openSnapshots = []; // [{id, props}], oldest first
const snapshotProps = new Map(); // id -> props, so a bumped panel can rebuild its mini-card

function enforceSnapshotCap() {
  while (openSnapshots.length > MAX_SNAPSHOTS) {
    const oldest = openSnapshots.shift();
    const el = document.getElementById(oldest.id);
    if (el) {
      minimizeDetailPanel(oldest.props, oldest.id, el);
      el.remove();
    }
    snapshotProps.delete(oldest.id);
  }
}

function buildDetailSnapshotPanel(props, snapId) {
  const panel = document.createElement("div");
  panel.id = snapId;
  panel.className = "glass right-panel-slot detail-snapshot";
  panel.innerHTML = `
    <div class="window-controls" role="group" aria-label="Panel controls">
      <button class="wc-dot wc-close" type="button" title="Close" aria-label="Close"></button>
      <button class="wc-dot wc-min" type="button" title="Minimize" aria-label="Minimize"></button>
    </div>
    <div class="detail-content-body">${buildDetailHTML(props)}</div>`;
  panel.querySelector(".wc-close").addEventListener("click", () => {
    panel.remove();
    snapshotProps.delete(snapId);
    const idx = openSnapshots.findIndex((s) => s.id === snapId);
    if (idx !== -1) openSnapshots.splice(idx, 1);
  });
  panel.querySelector(".wc-min").addEventListener("click", () => {
    minimizeDetailPanel(props, snapId, panel);
    panel.remove();
    snapshotProps.delete(snapId);
    const idx = openSnapshots.findIndex((s) => s.id === snapId);
    if (idx !== -1) openSnapshots.splice(idx, 1);
  });
  snapshotProps.set(snapId, props);
  return panel;
}

// `fromEl`, when given, is the panel/card about to disappear — its on-screen
// rect is what the new mini-card visually grows out of (see flipIn()).
function minimizeDetailPanel(props, reuseId, fromEl) {
  const snapId = reuseId || "detail-snapshot-" + (++snapshotSeq);
  const fromRect = fromEl ? fromEl.getBoundingClientRect() : null;
  const card = document.getElementById("detail-card");
  if (!reuseId && !card.hidden) {
    card.hidden = true;
    selectedName = null;
    if (map.getSource("selection")) map.getSource("selection").setData(emptyFC());
  }
  if (document.getElementById("min-card-" + snapId)) return;

  const c = COLORS[props.color] || "#9ca3af";
  const mini = document.createElement("div");
  mini.id = "min-card-" + snapId;
  mini.className = "mini-card";
  mini.title = "Restore full panel";
  mini.innerHTML = `
    <div class="mini-card-controls">
      <button class="wc-dot wc-close" type="button" title="Remove" aria-label="Remove"></button>
      <button class="wc-dot wc-zoom" type="button" title="Restore full panel" aria-label="Restore full panel"></button>
    </div>
    <div class="mini-card-name">${escapeHtml(props.name)}</div>
    <div class="mini-card-sub"><span class="mini-card-swatch" style="background:${c}"></span><span class="mini-card-status">${escapeHtml(props.status || "—")}</span></div>
    <div class="mini-card-cap">${escapeHtml(props.capacity || "—")}</div>`;
  // Red = remove, green = restore — no yellow, since there's nothing further
  // to minimize once already a mini-card. The whole card also restores on
  // click (bigger, more forgiving target); the dot is there so the action is
  // discoverable at a glance the way a real traffic light is, not something
  // you only find by clicking the card body itself.
  function restore() {
    const rect = mini.getBoundingClientRect();
    mini.remove();
    const panel = buildDetailSnapshotPanel(props, snapId);
    ensureSnapshotRow().appendChild(panel);
    // updateSnapshotRowOffset() only re-runs off a `hidden`-attribute change
    // on detail-card/regional-ai-panel/markets-panel (see the
    // MutationObserver below) - it never fires just because #snapshot-row
    // itself gains content. If one of those was ALREADY open before this,
    // its own hidden-flip happened before #snapshot-row even existed (the
    // row is created lazily, on first minimize), so the row was never
    // nudged out from under it. Restoring a snapshot is exactly that
    // "row now has content" moment, so re-check explicitly here rather than
    // relying on an attribute change that already happened.
    updateSnapshotRowOffset();
    openSnapshots.push({ id: snapId, props });
    flipIn(panel, rect);
    enforceSnapshotCap();
  }
  mini.querySelector(".wc-close").addEventListener("click", (e) => { e.stopPropagation(); mini.remove(); });
  mini.querySelector(".wc-zoom").addEventListener("click", (e) => { e.stopPropagation(); restore(); });
  mini.addEventListener("click", restore);
  ensureMinimizedTray().appendChild(mini);
  flipIn(mini, fromRect);
}


// ---- State ---------------------------------------------------------------
let statusFilter = "all";     // all | operating | construction | planned | atrisk
let regionFilter = "all";     // all | americas | europe | mena | apac
let colorFilter = null;       // null | taxonomy color key
let selectedName = null;
let spinning = false;         // retained for compatibility; autoplay is disabled
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


// Combines two GeoJSON FeatureCollections into one (US AFDC stations +
// EU IPCEI Observatory stations, js/eu-stations-data.js) - used both at
// initial load (with the US fallback) and once the live AFDC fetch lands
// (with real US data), so EU coverage is present either way.
function mergeFeatureCollections(...fcs) {
  return { type: "FeatureCollection", features: fcs.flatMap((fc) => (fc && fc.features) || []) };
}

// ---- Shared tab motion (see .tab-animate-in/.tab-detail-in in style.css) ----
// Staggered entrance for a tab's own cards - call once from each initXPage()
// after its innerHTML is set. Safe to call every time a page module inits,
// since the router only ever calls initXPage() once per route (loadedRoutes
// guard in 09-router.js), so this never replays on a plain tab switch back.
function animateCardsIn(root, selector = ".kpi-card, .dashboard-card") {
  root.querySelectorAll(selector).forEach((card, i) => {
    card.classList.add("tab-animate-in");
    card.style.animationDelay = `${i * 70}ms`;
  });
}

// Fade+rise a freshly-injected detail block - call right after setting a
// container's innerHTML in response to a deliberate, infrequent click (a
// catalog tab, a country selector) - not on live search-as-you-type, where
// re-animating every keystroke would be distracting rather than delightful.
function animateDetailIn(container) {
  const el = container && container.firstElementChild;
  if (el) el.classList.add("tab-detail-in");
}

// Every analytical card carries an explicit provenance declaration. Existing
// route modules can opt into modeled/illustrative via data-provenance; cards
// with scenario inputs are treated as modeled, and legacy sample/illustrative
// surfaces are removed unless Prototype Lab is explicitly enabled.
function applyAnalyticalProvenance(root) {
  if (!root) return;
  const prototypeEnabled = Boolean(window.H2G_CONFIG?.ENABLE_PROTOTYPE_WORKSPACES);
  root.querySelectorAll(".dashboard-card, .kpi-card, .calc-panel").forEach((card) => {
    if (!card.dataset.provenance) {
      if (card.querySelector(".badge-sample") || /\billustrative\b/i.test(card.textContent)) card.dataset.provenance = "illustrative";
      else if (card.querySelector('input[type="range"], input[type="number"]')) card.dataset.provenance = "modeled";
      else card.dataset.provenance = "observed";
    }
    if (card.dataset.provenance === "illustrative" && !prototypeEnabled) {
      card.remove();
      return;
    }
    if (card.querySelector(":scope > .provenance-badge")) return;
    const badge = document.createElement("span");
    badge.className = `provenance-badge ${card.dataset.provenance}`;
    badge.textContent = card.dataset.provenance === "illustrative" ? "Sandbox · Illustrative" :
      card.dataset.provenance.charAt(0).toUpperCase() + card.dataset.provenance.slice(1);
    card.prepend(badge);
    if (card.dataset.provenance === "illustrative") card.classList.add("sandbox-surface");
  });
}

// ---- Build layers on load ---------------------------------------------------
map.on("load", () => {
  addHubLayers();
  addLineLayer("pipelines", D.pipelines);
  addPointLayer("upstream", D.upstream);
  addPointLayer("production", D.production);
  addPointLayer("manufacturing", D.manufacturing);
  addPointLayer("storage", D.storagePoints);
  addPointLayer("endUse", D.endUse);
  addPointLayer("fuelingStations", mergeFeatureCollections(D.fuelingStationsFallback, window.EU_STATIONS_DATA), { small: true });
  addSelectionLayer();

  setStatus("fallback", "Cached stations");
  loadLiveStations();

  // DOM controls are wired on DOMContentLoaded by the spatial shell so they
  // remain usable even when remote map tiles load slowly. Map hit-testing is
  // the only binding that must wait for these layers to exist.
  wireClicks();
  setTheme(document.documentElement.dataset.theme || "dark");
});

// A theme chosen on DOMContentLoaded lands before the style finishes loading,
// so setTheme() only got as far as the DOM. Retry the map half on every
// styledata until one attempt sticks; styledata also fires after later style
// mutations, which keeps the paint correct if layers are re-added.
map.on("styledata", () => {
  if (pendingMapTheme !== null) setTheme(pendingMapTheme);
});


// ---- Theme (dark / light Liquid Glass) ----------------------------------------
function currentTheme() {
  return document.body.classList.contains("light") ? "light" : "dark";
}

// The theme whose map repaint has not landed yet, replayed on "styledata".
let pendingMapTheme = null;

// Cached because the WebGL layers (19-command-arcs, 20-spikes, 21-daynight) and
// the pulse loop (02-layers) need it inside their per-frame render callbacks.
// Reading document.documentElement.dataset.theme there meant a DOM lookup per
// layer per frame; setTheme() is the only thing that can change the answer.
let h2eliosLightMode = false;

// Theming splits in two: the DOM half always succeeds, the map half depends on
// the style being ready. map.getLayer() starts returning layers as soon as the
// style JSON is parsed, while setPaintProperty/setSky keep throwing "Style is
// not done loading" until the style completes — so guarding on getLayer was not
// enough, and the unguarded setSky() at the end of applyMapTheme() threw on
// every boot, taking the rest of shell init down with it.
//
// The guard is failure-driven rather than state-driven on purpose:
// isStyleLoaded() also reports false while a source retries failing tiles, and
// gating on it would leave the map permanently unthemed on a flaky network.
function setTheme(theme) {
  document.body.classList.toggle("light", theme === "light");
  h2eliosLightMode = theme === "light";
  try {
    applyMapTheme(theme);
    pendingMapTheme = null;
  } catch (error) {
    pendingMapTheme = theme;
  }
  try { localStorage.setItem("h2grid-theme", theme); } catch (e) { /* ignore */ }
}

function applyMapTheme(theme) {
  const dark = theme !== "light";

  if (map.getLayer && map.getLayer("basemap-dark")) {
    map.setLayoutProperty("basemap-dark", "visibility", dark ? "visible" : "none");
    map.setLayoutProperty("basemap-light", "visibility", dark ? "none" : "visible");
    map.setPaintProperty("basemap-light", "raster-opacity", dark ? 0 : 1);
    map.setPaintProperty("basemap-light", "raster-brightness-min", dark ? 0 : 0.08);
    map.setPaintProperty("basemap-light", "raster-brightness-max", dark ? 1 : 1);
    map.setPaintProperty("basemap-light", "raster-contrast", dark ? 0 : 0.06);
    map.setPaintProperty("basemap-light", "raster-saturation", dark ? 0 : -0.32);
  }
  if (map.getLayer && map.getLayer("hub-labels")) {
    map.setPaintProperty("hub-labels", "text-halo-color", dark ? "#01030a" : "#f4f7fc");
    map.setPaintProperty("hub-labels", "text-color",
      ["case", ["==", ["get", "funding"], "terminated"], dark ? "#fca5a5" : "#b91c1c", dark ? "#6ee7c5" : "#047857"]);
  }
  if (map.getLayer && map.getLayer("land-fill")) {
    map.setPaintProperty("land-fill", "fill-color", dark ? "#0b132b" : "#d9e3ee");
    map.setPaintProperty("land-fill", "fill-opacity", dark ? 0.6 : 0.82);
  }
  if (map.getLayer && map.getLayer("night-lights")) {
    map.setPaintProperty("night-lights", "raster-opacity", dark
      ? ["interpolate", ["linear"], ["zoom"], 2, 0.7, 6, 0]
      : 0);
  }
  if (map.getLayer && map.getLayer("coast-glow")) {
    map.setPaintProperty("coast-glow", "line-color", dark ? "#00f0ff" : "#3b8196");
    map.setPaintProperty("coast-glow", "line-opacity", dark
      ? ["interpolate", ["linear"], ["zoom"], 0, 0.32, 3, 0.32, 6, 0.15, 9, 0.15]
      : ["interpolate", ["linear"], ["zoom"], 0, 0.045, 3, 0.045, 6, 0.02, 9, 0.02]);
  }
  if (map.getLayer && map.getLayer("coast")) {
    map.setPaintProperty("coast", "line-color", dark ? "#7fe6f2" : "#2f6576");
    map.setPaintProperty("coast", "line-opacity", dark ? 0.55 : 0.68);
  }
  if (map.getLayer && map.getLayer("pipelines-dash")) {
    map.setPaintProperty("pipelines-dash", "line-color", dark ? "#eef3fc" : "#22314d");
  }
  ["flows-base", "flows-dash"].forEach((id) => {
    if (map.getLayer && map.getLayer(id)) map.setPaintProperty(id, "line-color", dark ? COLOR_MATCH : LIGHT_COLOR_MATCH);
  });
  if (map.getLayer && map.getLayer("flow-particles")) {
    map.setPaintProperty("flow-particles", "circle-color", dark ? COLOR_MATCH : LIGHT_COLOR_MATCH);
  }
  ["upstream", "production", "manufacturing", "storage", "endUse", "fuelingStations"].forEach((id) => {
    if (map.getLayer && map.getLayer(id)) {
      map.setPaintProperty(id, "circle-color", dark ? COLOR_MATCH : LIGHT_COLOR_MATCH);
      map.setPaintProperty(id, "circle-opacity", dark ? FILL_OPACITY_EXPR : [
        "match", ["get", "statusClass"], "planned", 0.58, "atrisk", 0.92, "construction", 0.94, 0.96
      ]);
      map.setPaintProperty(id, "circle-blur", dark ? FILL_BLUR_EXPR : [
        "match", ["get", "statusClass"], "planned", 0.18, 0.06
      ]);
    }
    const glowId = id + "-glow";
    if (map.getLayer && map.getLayer(glowId)) {
      map.setPaintProperty(glowId, "circle-color", dark ? COLOR_MATCH : LIGHT_COLOR_MATCH);
      map.setPaintProperty(glowId, "circle-blur", dark ? 1 : 0.42);
      map.setPaintProperty(glowId, "circle-opacity", dark ? 0.3 : 0.055);
    }
  });
  ["pipelines", "pipelines-glow"].forEach((id) => {
    if (map.getLayer && map.getLayer(id)) map.setPaintProperty(id, "line-color", dark ? COLOR_MATCH : LIGHT_COLOR_MATCH);
  });
  if (map.getLayer && map.getLayer("pipelines-glow")) {
    map.setPaintProperty("pipelines-glow", "line-opacity", dark ? 0.1 : 0.035);
    map.setPaintProperty("pipelines-glow", "line-blur", dark ? 4 : 1.5);
  }
  if (map.getLayer && map.getLayer("iea-points")) {
    map.setPaintProperty("iea-points", "circle-color", dark ? "#3fd6e8" : "#0b7480");
    map.setPaintProperty("iea-points", "circle-blur", dark ? 0.65 : 0.12);
    map.setPaintProperty("iea-points", "circle-stroke-color", dark ? "#3fd6e8" : "#075b66");
  }
  if (map.getLayer && map.getLayer("iea-clusters")) {
    map.setPaintProperty("iea-clusters", "circle-color", dark ? "rgba(63, 214, 232, 0.05)" : "rgba(11, 116, 128, 0.08)");
    map.setPaintProperty("iea-clusters", "circle-stroke-color", dark ? "#3fd6e8" : "#075b66");
    map.setPaintProperty("iea-cluster-count", "text-color", dark ? "#3fd6e8" : "#075b66");
    map.setPaintProperty("iea-cluster-count", "text-halo-color", dark ? "#01030a" : "#f5f8fb");
  }
  if (map.getLayer && map.getLayer("hubs")) {
    map.setPaintProperty("hubs", "fill-color", ["case", ["==", ["get", "funding"], "terminated"], dark ? "#f87171" : "#b91c1c", dark ? "#34e0a1" : "#087a55"]);
  }
  if (map.getLayer && map.getLayer("hubs-outline")) {
    map.setPaintProperty("hubs-outline", "line-color", ["case", ["==", ["get", "funding"], "terminated"], dark ? "#f87171" : "#b91c1c", dark ? "#34e0a1" : "#087a55"]);
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
      "sky-color": "#f3f7fb",
      "horizon-color": "#d7e2ee",
      "fog-color": "#eef3f8",
      "sky-horizon-blend": 0.28,
      "horizon-fog-blend": 0.28,
      "fog-ground-blend": 0.32,
      "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.22, 3, 0.22, 6, 0.025, 9, 0]
    });
  }
}

function wireTheme() {
  setTheme(document.documentElement.dataset.theme || "dark");
  const btn = document.getElementById("theme-btn");
  if (btn) btn.style.display = "none";
}


function stopSpin() { spinning = false; }


// ---- Utils --------------------------------------------------------------------------------------------------
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;");
}
