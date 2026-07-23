/* ==========================================================================
   H2Grid · Live API tier
   Connects the globe + status filter + analytics panel to the real backend
   (GET /api/projects, /api/analytics/summary, /api/projects/:slug), as a
   viewport-scoped layer alongside the curated and IEA-snapshot tiers.
   Follows the same additive-tier + wrap-and-call-through conventions as
   iea-layer.js / hud.js / 08-analytics.js. Load after 05-detail.js
   (selectFacility/showDetail) and 03-filters.js (applyFilters, statusFilter,
   TOGGLE_MAP) — see index.html.
   ======================================================================= */

(function () {
  const API_HOLO = "#facc15"; // distinct from IEA's cyan, so the two tiers read as separate layers

  // API current_state -> the same 4-bucket statusClass taxonomy the rest of the
  // UI already uses. 'fid' folds into 'construction' (same coarsening the ETL's
  // own statusClass derivation used); 'cancelled' has no UI bucket and is
  // simply never requested.
  const STATE_TO_STATUS_CLASS = {
    live: "operating",
    construction: "construction",
    fid: "construction",
    planned: "planned",
    at_risk: "atrisk"
  };
  const STATUS_CLASS_TO_STATE = {
    operating: "live",
    construction: "construction,fid",
    planned: "planned",
    atrisk: "at_risk"
  };

  let fetchToken = 0; // guards a slow, stale fetch from overwriting a newer one

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  // Real-time solar ephemeris -> MapLibre light. SunCalc.getPosition(time, lat, lng)
  // returns { altitude, azimuth } in radians: altitude is 0 at the horizon,
  // +PI/2 at the zenith, and *negative* once the sun is below the horizon;
  // azimuth is measured from south, sweeping clockwise toward west (0 = S,
  // PI/2 = W, +/-PI = N, -PI/2 = E) - see SunCalc's own docs, not MapLibre's.
  function updateSunLight() {
    const center = map.getCenter();
    const sun = SunCalc.getPosition(new Date(), center.lat, center.lng);
    const altitudeDeg = (sun.altitude * 180) / Math.PI;
    const azimuthDeg = (sun.azimuth * 180) / Math.PI;

    // Compass bearing (0 = N, clockwise) is what MapLibre's azimuthal
    // position expects for anchor:"map" - shift SunCalc's south-origin
    // azimuth by 180deg to convert.
    const bearing = (azimuthDeg + 180 + 360) % 360;

    // MapLibre polar: 0 = zenith, 90 = horizon. Clamped to [8, 88] rather
    // than passed through raw: map.setLight() only drives per-face
    // shading, not a real day/night terminator or self-occlusion, so once
    // the true altitude goes negative (real nighttime at the viewport's
    // center) an unclamped polar angle would swing past the horizon into
    // physically-meaningless territory and the extrusions would either go
    // flat or light from "underground". Clamping keeps the light always
    // sourced from a low, dramatic, above-horizon angle while its
    // direction (bearing) and intensity/color still genuinely track the
    // real sun.
    const polar = clamp(90 - altitudeDeg, 8, 88);

    // Dimmer and warmer (golden-hour amber) near the horizon; brighter and
    // crisp white as the sun climbs - real solar altitude driving both.
    const daylight = clamp(Math.sin(sun.altitude), -1, 1); // ~1 at zenith, ~0 at horizon, negative at night
    const intensity = clamp(0.55 + 0.4 * Math.max(0, daylight), 0.55, 0.95);
    const color = altitudeDeg < 12 ? "#ffb347" : "#ffffff";

    map.setLight({ anchor: "map", color, intensity, position: [1.4, bearing, polar] });
  }

  // Subsolar point (where the sun is at true zenith) - viewport-independent,
  // a fixed lat/lng for a given instant. SunCalc's public API only answers
  // "what does the sun look like FROM this lat/lng" (getPosition), not the
  // inverse, so there's no SunCalc call that gives this directly. This is
  // the same underlying solar-position algorithm SunCalc itself is built on
  // (mean anomaly -> ecliptic longitude -> declination + right ascension,
  // via NOAA's public-domain solar position formulas), just solved for the
  // point of maximum altitude instead of altitude-at-a-point.
  function subsolarPoint(date) {
    const rad = Math.PI / 180;
    const dayMs = 86400000;
    const J1970 = 2440588, J2000 = 2451545;
    const d = date.valueOf() / dayMs - 0.5 + J1970 - J2000; // days since J2000.0

    const M = rad * (357.5291 + 0.98560028 * d); // solar mean anomaly
    const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M)); // equation of center
    const P = rad * 102.9372; // Earth's perihelion
    const L = M + C + P + Math.PI; // ecliptic longitude of the sun
    const e = rad * 23.4397; // Earth's axial tilt (obliquity of the ecliptic)

    const dec = Math.asin(Math.sin(e) * Math.sin(L)); // declination = subsolar latitude
    const ra = Math.atan2(Math.sin(L) * Math.cos(e), Math.cos(L)); // right ascension

    const gmstDeg = 280.16 + 360.9856235 * d; // Greenwich mean sidereal time, degrees
    const lngDeg = (((ra / rad) - gmstDeg) % 360 + 540) % 360 - 180; // wrap to (-180, 180]
    return [lngDeg, dec / rad];
  }

  let subsolarMarker = null;
  function updateSubsolarMarker() {
    const [lng, lat] = subsolarPoint(new Date());
    if (!subsolarMarker) {
      const el = document.createElement("div");
      el.className = "subsolar-marker";
      subsolarMarker = new maplibregl.Marker({ element: el, pitchAlignment: "map" }).setLngLat([lng, lat]).addTo(map);
    } else {
      subsolarMarker.setLngLat([lng, lat]);
    }
  }

  // Globe projection at low zoom can report bounds outside +/-180 lng, which
  // PostGIS's geography cast rejects outright - clamp to the safe range rather
  // than let a wide-open initial view 500 on the API.
  function currentBboxParam() {
    const b = map.getBounds();
    const west = clamp(b.getWest(), -180, 180);
    const east = clamp(b.getEast(), -180, 180);
    const south = clamp(b.getSouth(), -85, 85);
    const north = clamp(b.getNorth(), -85, 85);
    return [west, south, east, north].join(",");
  }

  function currentStatusParam() {
    if (statusFilter === "all") return null;
    return STATUS_CLASS_TO_STATE[statusFilter] || null;
  }

  function scaleFromCapacity(mw) {
    if (mw == null) return 1;
    if (mw >= 1000) return 8;
    if (mw >= 250) return 7;
    if (mw >= 100) return 6;
    if (mw >= 50) return 5;
    if (mw >= 10) return 4;
    if (mw >= 1) return 3;
    return 2;
  }

  // The API's `technology` is a free-text code slugified from the source's
  // `subtype` (e.g. "pem", "alk", "smr-ccus") - not the green/blue/pink
  // taxonomy key used by the legend/COLOR_MATCH. Map the common electrolysis
  // families onto that taxonomy; everything else defaults like the ETL does.
  function technologyColor(tech) {
    const t = String(tech || "").toLowerCase();
    if (t.includes("pem") || t.includes("alk") || t.includes("aem") || t.includes("soec")) return "green";
    if (t.includes("ccus")) return "blue";
    if (t.includes("smr") || t.includes("gasification")) return "gray_blue";
    if (t.includes("mfg") || t.includes("manufactur")) return "mfg";
    return "gray_blue";
  }

  // Lightens a hex color toward white by `amt` (0-1). Used to build a
  // "bright/hot" variant of each taxonomy color for the capacity-driven
  // luminosity interpolation below, generated from the existing global
  // COLORS map (01-core.js) rather than a second hardcoded palette.
  function lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const mix = (c) => Math.round(c + (255 - c) * amt);
    const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  }

  const COLOR_MATCH_BRIGHT = COLOR_MATCH.map((v) =>
    typeof v === "string" && v.startsWith("#") ? lighten(v, 0.55) : v
  );

  // Point -> small regular-polygon "spike base" (square by default), pure JS,
  // no Turf dependency. radiusDeg is longitude-scaled by cos(lat) so squares
  // stay roughly square instead of stretching near the poles.
  function pointToPolygon(lng, lat, radiusDeg, sides) {
    const latRad = (lat * Math.PI) / 180;
    const lngScale = Math.cos(latRad) || 0.0001; // guard divide-by-zero near the poles
    const ring = [];
    for (let i = 0; i <= sides; i++) {
      const theta = (i / sides) * Math.PI * 2;
      ring.push([lng + (radiusDeg / lngScale) * Math.cos(theta), lat + radiusDeg * Math.sin(theta)]);
    }
    return { type: "Polygon", coordinates: [ring] };
  }

  // fill-extrusion-height is real meters against Earth's ~6,371km radius, so a
  // literal "capacity in meters" spike would be invisible from orbit. This is
  // a deliberately exaggerated, non-physical scale tuned to look right at
  // globe zoom, not a real-world unit conversion - a starting point to tune
  // visually, not a spec.
  //
  // capacity_mw is clamped to SPIKE_HEIGHT_CLAMP_MW before the exponential:
  // the dataset's max is ~10.7M "MW" (up to 10723000 seen directly in the DB),
  // an ETL data-quality artifact from the kt-H2/yr-to-MW storage-capacity
  // approximation (see etl/import-iea-data.js's own comment on this), not a
  // real power rating. Unclamped, that one row alone would produce a spike
  // ~58,656km tall - over 9x Earth's radius. 5000 MW comfortably covers the
  // largest legitimate electrolysis/CCUS projects while capping the outliers.
  const SPIKE_HEIGHT_FACTOR = 6000; // meters per (clamped capacity_mw ^ 0.45)
  const SPIKE_HEIGHT_EXPONENT = 0.45; // flatter still than the prior 0.5 - keeps outliers from eclipsing dense clusters (e.g. Europe)
  const SPIKE_HEIGHT_CLAMP_MW = 4000; // max height now ~251km at 0.45 (was ~379km at 0.5)
  const SPIKE_BASE_RADIUS_DEG = 0.12; // ~13km across at the equator

  function toExtrusionFeature(row) {
    const capacityMw = row.capacity_mw != null ? Number(row.capacity_mw) : null;
    return {
      type: "Feature",
      geometry: pointToPolygon(row.lng, row.lat, SPIKE_BASE_RADIUS_DEG, 4),
      properties: {
        capacity_mw: capacityMw != null ? capacityMw : 1,
        color: technologyColor(row.technology),
        statusClass: STATE_TO_STATUS_CLASS[row.status] || "planned"
      }
    };
  }

  function toFeature(row) {
    const capacityMw = row.capacity_mw != null ? Number(row.capacity_mw) : null;
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: [row.lng, row.lat] },
      properties: {
        id: row.id,
        slug: row.slug,
        name: row.slug, // real name only known once the /:slug detail fetch resolves
        statusClass: STATE_TO_STATUS_CLASS[row.status] || "planned",
        status: row.status,
        capacity: capacityMw != null ? `${capacityMw} MW` : "Not disclosed",
        capacity_mw: capacityMw,
        scale: scaleFromCapacity(capacityMw),
        technology: row.technology,
        color: technologyColor(row.technology),
        tier: "api"
      }
    };
  }

  // Full detail (GET /api/projects/:slug) -> the same properties shape
  // selectFacility/showDetail expect from every other tier.
  function toDetailProps(full) {
    const capacityMw = full.capacity_mw != null ? Number(full.capacity_mw) : null;
    return {
      id: full.id,
      slug: full.slug,
      name: full.name,
      subtype: full.technology_label,
      category: full.category,
      color: technologyColor(full.technology),
      statusClass: STATE_TO_STATUS_CLASS[full.status] || "planned",
      status: full.status,
      capacity: capacityMw != null ? `${capacityMw} MW` : "Not disclosed",
      operator: null,
      region: full.region,
      country: full.country_code,
      source: (full.sources || [])[0],
      updated: full.updated_at ? new Date(full.updated_at).toLocaleDateString() : null,
      note: `Live API record · ${full.state_history.length} state change(s), ${full.metric_history.length} metric revision(s) on file.`,
      confidence: full.confidence != null ? Number(full.confidence) : null,
      tier: "api"
    };
  }

  async function fetchProjects() {
    const token = ++fetchToken;
    const params = new URLSearchParams({ bbox: currentBboxParam() });
    const status = currentStatusParam();
    if (status) params.set("status", status);

    let rows;
    try {
      const res = await fetch(`/api/projects?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      rows = await res.json();
    } catch (err) {
      console.error("live API fetch failed", err);
      return;
    }
    if (token !== fetchToken) return; // a newer request already landed

    // colorFilter (hydrogen-taxonomy legend) has no server-side equivalent -
    // the API's end_use filter is a different axis (mobility/ammonia/...) -
    // so it's applied client-side here, same as the curated/IEA tiers do.
    const visibleRows = colorFilter ? rows.filter((r) => technologyColor(r.technology) === colorFilter) : rows;

    if (map.getSource("api-projects")) {
      map.getSource("api-projects").setData({ type: "FeatureCollection", features: visibleRows.map(toFeature) });
    }
    if (map.getSource("api-projects-extrusion")) {
      map.getSource("api-projects-extrusion").setData({ type: "FeatureCollection", features: visibleRows.map(toExtrusionFeature) });
    }

    // Summary reflects bbox+status (server-side filters); the legend's color
    // narrowing is presentation-only and intentionally not reflected here.
    fetchSummary(params);
  }

  async function fetchSummary(params) {
    let data;
    try {
      const res = await fetch(`/api/analytics/summary?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.json();
    } catch (err) {
      console.error("summary fetch failed", err);
      return;
    }
    renderApiSummary(data);
  }

  // Odometer: rolls an element's displayed number from whatever it currently
  // shows to a new target over ~800ms, easeOutExpo (fast start, gentle
  // settle). Reads the previous value back out of the DOM itself (stripped of
  // formatting) rather than tracking it separately, so it stays correct even
  // if a render is skipped or arrives out of order.
  function easeOutExpo(t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); }

  const odometerRafIds = new WeakMap();
  function odometer(el, target, { duration = 800, format = (n) => Math.round(n).toLocaleString() } = {}) {
    if (!el) return;
    const prevRaf = odometerRafIds.get(el);
    if (prevRaf) cancelAnimationFrame(prevRaf);

    const start = Number(String(el.dataset.rawValue || el.textContent).replace(/[^0-9.-]/g, "")) || 0;
    const suffix = el.dataset.suffix || "";
    if (start === target) { el.textContent = format(target) + suffix; el.dataset.rawValue = target; return; }

    const t0 = performance.now();
    function step(now) {
      const t = Math.min(1, (now - t0) / duration);
      const value = start + (target - start) * easeOutExpo(t);
      el.textContent = format(value) + suffix;
      if (t < 1) {
        odometerRafIds.set(el, requestAnimationFrame(step));
      } else {
        el.textContent = format(target) + suffix;
        el.dataset.rawValue = target;
      }
    }
    odometerRafIds.set(el, requestAnimationFrame(step));
  }

  function renderApiSummary(data) {
    const mwEl = document.getElementById("api-summary-mw");
    const countEl = document.getElementById("api-summary-count");
    const listEl = document.getElementById("api-summary-by-tech");
    if (!mwEl || !countEl || !listEl) return;

    mwEl.dataset.suffix = " MW";
    countEl.dataset.suffix = "";
    odometer(mwEl, data.totals.total_capacity_mw);
    odometer(countEl, data.totals.project_count);

    const byTech = data.by_technology.filter((r) => r.technology);
    const max = Math.max(1, ...byTech.map((r) => Number(r.total_capacity_mw)));
    listEl.innerHTML = byTech.slice(0, 8).map((r) => {
      const pct = Math.round((Number(r.total_capacity_mw) / max) * 100);
      return `<div class="bar-row">
        <span class="bar-label">${escapeHtml(r.technology)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${API_HOLO};color:${API_HOLO}"></span></span>
        <span class="bar-count">${Math.round(Number(r.total_capacity_mw)).toLocaleString()} MW</span>
      </div>`;
    }).join("");
  }

  // Debounce viewport-driven refetches so a drag/zoom gesture fires one
  // request after the camera settles, not one per animation frame.
  let moveDebounce = null;
  function scheduleFetch(delay) {
    clearTimeout(moveDebounce);
    moveDebounce = setTimeout(fetchProjects, delay);
  }

  map.on("load", () => {
    map.addSource("api-projects", { type: "geojson", data: { type: "FeatureCollection", features: [] } });

    map.addLayer({
      id: "api-projects-glow", type: "circle", source: "api-projects",
      paint: {
        "circle-color": API_HOLO,
        "circle-radius": GLOW_RADIUS_EXPR,
        "circle-opacity": 0.12,
        "circle-blur": 0.9
      }
    });
    map.addLayer({
      id: "api-projects", type: "circle", source: "api-projects",
      paint: {
        "circle-color": COLOR_MATCH,
        "circle-radius": RADIUS_EXPR,
        "circle-opacity": FILL_OPACITY_EXPR,
        "circle-stroke-color": STROKE_COLOR_EXPR,
        "circle-stroke-width": STROKE_WIDTH_EXPR
      }
    });

    // "Spikey Earth" - each project rendered as a small extruded polygon whose
    // height encodes capacity. The circle layers above stay as the actual
    // click/hover target (extrusion picking gets unreliable at these small
    // footprint sizes); the extrusion is purely the visual on top of it.
    map.addSource("api-projects-extrusion", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
    map.addLayer({
      id: "api-projects-extrusion", type: "fill-extrusion", source: "api-projects-extrusion",
      paint: {
        // Bigger projects don't just stand taller - they run "hotter": color
        // interpolates from the normal taxonomy color up toward a lightened
        // variant as capacity approaches the clamp ceiling, on top of the
        // built-in fill-extrusion-vertical-gradient shading below.
        "fill-extrusion-color": [
          "interpolate", ["linear"], ["coalesce", ["get", "capacity_mw"], 1],
          0, COLOR_MATCH,
          SPIKE_HEIGHT_CLAMP_MW, COLOR_MATCH_BRIGHT
        ],
        "fill-extrusion-height": [
          "*",
          ["^", ["min", ["max", ["coalesce", ["get", "capacity_mw"], 1], 1], SPIKE_HEIGHT_CLAMP_MW], SPIKE_HEIGHT_EXPONENT],
          SPIKE_HEIGHT_FACTOR
        ],
        "fill-extrusion-opacity": 0.85,
        "fill-extrusion-vertical-gradient": true
      }
    });
    // Ground-level bloom: a large, heavily blurred circle at each spike's
    // base (reusing the existing "api-projects" point source - no new
    // source needed), inserted directly beneath the extrusion layer so the
    // spikes read as radiating light onto the surface around them.
    map.addLayer({
      id: "api-projects-bloom", type: "circle", source: "api-projects",
      paint: {
        "circle-color": COLOR_MATCH,
        "circle-radius": ["+", 14, ["*", 2.2, ["coalesce", ["get", "scale"], 2]]],
        "circle-blur": 1.5,
        "circle-opacity": 0.35
      }
    }, "api-projects-extrusion");
    // Real-time solar ephemeris: map.setLight()'s directional shading now
    // tracks the true sun position for whatever the viewport is currently
    // centered on, via SunCalc (index.html CDN include, loaded before this
    // script). Recomputed on an interval (the sun moves slowly - no need
    // for a per-frame update) and on moveend (viewport center, and so the
    // relevant lat/lng for SunCalc, only changes when a pan/zoom/rotate
    // settles - moveend is itself the natural throttle point, already only
    // firing once per gesture rather than per drag frame).
    // Honesty note (unchanged from prior verification against the project's
    // own maplibre-gl@5.24 changelog): map.setLight() is MapLibre's only
    // stable, documented lighting API. It drives per-face directional
    // *shading* only - there is no documented, stable cast-shadow feature
    // that would throw a spike's shadow onto the earth-mass fill below it,
    // and it has no concept of a day/night terminator sweeping the globe.
    // What follows is a genuinely real-time sun *direction*, applied
    // through that same shading-only model.
    updateSunLight();
    updateSubsolarMarker();
    setInterval(() => { updateSunLight(); updateSubsolarMarker(); }, 60000);
    map.on("moveend", updateSunLight); // subsolar point is viewport-independent - no need to recompute on pan/zoom

    TOGGLE_MAP.apiLive = ["api-projects", "api-projects-glow", "api-projects-extrusion", "api-projects-bloom"];

    map.on("click", "api-projects", async (e) => {
      const base = Object.assign({}, e.features[0].properties);
      selectFacility(base, [e.lngLat.lng, e.lngLat.lat]); // show immediately with what's already loaded

      // Cinematic swoop into the clicked spike, alongside (not blocking) the
      // detail fetch below. Bearing is deliberately left at whatever it
      // currently is (not forced to a fixed value) so the camera doesn't
      // spin unpredictably out from under the user on every click.
      if (typeof stopSpin === "function") stopSpin();
      map.flyTo({ center: [e.lngLat.lng, e.lngLat.lat], zoom: 9.5, pitch: 65, duration: 1800 });

      try {
        const res = await fetch(`/api/projects/${encodeURIComponent(base.slug)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const full = await res.json();
        // Only replace the sheet if the user hasn't since clicked something else.
        if (selectedName === base.name) selectFacility(toDetailProps(full), [full.lng, full.lat]);
      } catch (err) {
        console.error("detail fetch failed", err);
      }
    });

    map.on("mouseenter", "api-projects", (e) => {
      map.getCanvas().style.cursor = "pointer";
      const p = e.features[0].properties;
      hoverPopup.setLngLat(e.lngLat)
        .setHTML(`<div class="popup-title">${escapeHtml(p.name)}</div><div class="popup-sub">Live API · ${escapeHtml(p.technology || "")} · ${escapeHtml(p.status || "")}</div>`)
        .addTo(map);
    });
    map.on("mouseleave", "api-projects", () => {
      map.getCanvas().style.cursor = "";
      hoverPopup.remove();
    });

    map.on("moveend", () => scheduleFetch(300));
    fetchProjects();
  });

  // Chain into the shared filter pipeline: status/region changes don't move
  // the camera, so they need their own refetch (viewport-driven moveend won't
  // fire for them).
  const _applyFilters = applyFilters;
  applyFilters = function () {
    _applyFilters();
    if (map.getSource && map.getSource("api-projects")) scheduleFetch(0);
  };
})();

/* ==========================================================================
   Cosmetic: orbiting satellites (~Starlink layer)
   Purely decorative, independent of the API-data pipeline above - own IIFE
   so it doesn't share state with it. Each satellite follows a real
   great-circle ground-track parametrization (inclination + right ascension +
   along-orbit angle), which is barely more code than a fake sinusoid and
   looks far more convincing. Runs only while zoomed out past the same zoom-6
   ground-level threshold the starfield/atmosphere fade already uses (see
   07-live.js) - paused entirely (rAF loop stopped, layers hidden) once
   zoomed into a region, since satellites over a regional view would be
   noise, not signal, and there's no reason to keep animating something
   nobody can see.
   ======================================================================= */
(function () {
  const SAT_COUNT = 40;
  const GROUND_ZOOM_THRESHOLD = 6; // matches 07-live.js's --bg-fx fade schedule

  function generateSatellites(n) {
    const features = [];
    for (let i = 0; i < n; i++) {
      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [0, 0] },
        properties: {
          raan: Math.random() * 360, // right ascension (deg) - fixes the orbital plane's longitude
          inclination: ((Math.random() * 140 - 70) * Math.PI) / 180, // radians; avoid near-polar orbits for visual variety
          theta: Math.random() * Math.PI * 2, // current along-orbit angle (radians)
          speed: 0.015 + Math.random() * 0.035 // radians/sec -> one full orbit every ~90-420s
        }
      });
    }
    return { type: "FeatureCollection", features };
  }

  function stepSatellites(fc, dtSec) {
    fc.features.forEach((f) => {
      const p = f.properties;
      p.theta += p.speed * dtSec;
      const lat = (Math.asin(Math.sin(p.inclination) * Math.sin(p.theta)) * 180) / Math.PI;
      let lng = p.raan + (Math.atan2(Math.cos(p.inclination) * Math.sin(p.theta), Math.cos(p.theta)) * 180) / Math.PI;
      lng = ((((lng + 180) % 360) + 360) % 360) - 180; // dateline-safe wrap to [-180, 180]
      f.geometry.coordinates = [lng, lat];
    });
    return fc;
  }

  const satelliteData = generateSatellites(SAT_COUNT);
  let running = false;
  let lastTs = null;

  function frame(ts) {
    if (!running) return;
    if (lastTs == null) lastTs = ts;
    const dtSec = Math.min(0.25, (ts - lastTs) / 1000); // clamp so a backgrounded tab doesn't jump-cut on return
    lastTs = ts;
    stepSatellites(satelliteData, dtSec);
    const src = map.getSource("satellites");
    if (src) src.setData(satelliteData);
    requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    lastTs = null;
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  function syncVisibility() {
    const visible = map.getZoom() <= GROUND_ZOOM_THRESHOLD;
    map.setLayoutProperty("satellites", "visibility", visible ? "visible" : "none");
    map.setLayoutProperty("satellites-bloom", "visibility", visible ? "visible" : "none");
    if (visible) start(); else stop();
  }

  map.on("load", () => {
    map.addSource("satellites", { type: "geojson", data: satelliteData });

    // Bloom: larger, near-transparent, blurred cyan halo underneath the
    // sharp white dot - "1.5px white dot with a cyan outer glow" per spec.
    map.addLayer({
      id: "satellites-bloom", type: "circle", source: "satellites",
      paint: { "circle-radius": 6, "circle-color": "#00f0ff", "circle-opacity": 0.18, "circle-blur": 1 }
    });
    map.addLayer({
      id: "satellites", type: "circle", source: "satellites",
      paint: { "circle-radius": 1.5, "circle-color": "#ffffff", "circle-opacity": 0.9 }
    });

    map.on("zoom", syncVisibility);
    syncVisibility();
  });
})();

/* ==========================================================================
   Cosmetic: "Comet Pulse" great-circle hub connections
   Illustrative network-topology overlay (same "illustrative" framing as the
   existing D.flows/web layer in 01-core.js - hardcoded routes between
   recognizable hydrogen-economy hub regions, not derived from real
   contracted supply chains). Own IIFE, independent of the API-data pipeline.

   Technical note on the animation approach: MapLibre's style spec has no
   "line-dash-offset" property to animate - the only native options are (a)
   stepping through precomputed line-dasharray arrays each frame, which is
   zoom-dependent (the pattern repeats in screen-pixel space, so a comet's
   real-world position/speed would drift as you zoom), or (b) driving a short
   moving LineString segment via source.setData() each frame. This uses (b) -
   the same pattern the satellites layer above already validated as cheap at
   60fps - since it gives a true, zoom-independent "shooting" comet instead of
   a visually steppy dash cycle.

   Also uses real spherical great-circle interpolation (slerp in 3D unit-
   vector space) rather than the planar quadratic-bezier arcCoords() already
   used for D.flows in 01-core.js. Working in 3D Cartesian space makes the
   180/-180 dateline a non-issue by construction (atan2 naturally returns
   longitude in (-180, 180]) rather than needing a special case for it.
   ======================================================================= */
(function () {
  // Hardcoded for visual impact, per spec - recognizable hydrogen-economy hub
  // regions, not a real supply-chain dataset.
  const ROUTES = [
    { from: [4.4777, 51.9244], to: [-95.3698, 29.7604], name: "Rotterdam -> Houston" },
    { from: [-95.3698, 29.7604], to: [56.3269, 25.1288], name: "Houston -> Fujairah" },
    { from: [56.3269, 25.1288], to: [129.3114, 35.5384], name: "Fujairah -> Ulsan" },
    { from: [129.3114, 35.5384], to: [118.6, -20.7], name: "Ulsan -> Pilbara" },
    { from: [118.6, -20.7], to: [4.4777, 51.9244], name: "Pilbara -> Rotterdam" },
    { from: [14.5, -22.9], to: [4.4777, 51.9244], name: "Walvis Bay -> Rotterdam" },
    { from: [-70.9, -53.2], to: [6.76, 51.43], name: "Magallanes -> Duisburg" },
    { from: [-118.2, 34.0], to: [103.82, 1.35], name: "California -> Singapore" }
  ];
  const ARC_STEPS = 128; // points per full route, precomputed once
  const COMET_SPAN = 0.035; // comet length as a fraction of the route

  function toRad(d) { return (d * Math.PI) / 180; }
  function toDeg(r) { return (r * 180) / Math.PI; }

  // Spherical linear interpolation between two [lng,lat] points, fraction f
  // in [0,1]. Returns [lng,lat]. Degenerate (identical/antipodal) inputs
  // guarded rather than dividing by sin(0).
  function slerp(a, b, f) {
    const lat1 = toRad(a[1]), lng1 = toRad(a[0]);
    const lat2 = toRad(b[1]), lng2 = toRad(b[0]);
    const d = Math.acos(Math.min(1, Math.max(-1,
      Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(lng1 - lng2)
    )));
    if (d < 1e-9) return [a[0], a[1]];
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    return [toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))];
  }

  function greatCirclePoints(from, to, steps) {
    const pts = [];
    for (let i = 0; i <= steps; i++) pts.push(slerp(from, to, i / steps));
    return pts;
  }

  const routeArcs = ROUTES.map((r) => ({
    points: greatCirclePoints(r.from, r.to, ARC_STEPS),
    phase: Math.random(), // stagger launch so pulses don't all fire in unison
    speed: 0.09 + Math.random() * 0.05 // full traverses per second
  }));

  function baselineFC() {
    return {
      type: "FeatureCollection",
      features: routeArcs.map((r) => ({
        type: "Feature",
        geometry: { type: "LineString", coordinates: r.points },
        properties: {}
      }))
    };
  }

  // Slices a route's precomputed point array to [t, t+COMET_SPAN], wrapping
  // around the end back to the start so the comet loops continuously.
  function cometSlice(points, t) {
    const n = points.length;
    const startIdx = Math.floor(t * (n - 1));
    const spanCount = Math.max(2, Math.round(COMET_SPAN * (n - 1)));
    const coords = [];
    for (let i = 0; i <= spanCount; i++) coords.push(points[(startIdx + i) % n]);
    return coords;
  }

  // Two packets per route (leader + a trailing packet ~8% of the route
  // behind it) for a multi-packet "fiber optic" feel rather than one dot
  // traveling alone.
  const TRAIL_LAG = 0.08;
  function cometsFC(ts) {
    const features = [];
    routeArcs.forEach((r) => {
      const t = (ts * r.speed + r.phase) % 1;
      const tTrail = (t - TRAIL_LAG + 1) % 1;
      features.push({ type: "Feature", geometry: { type: "LineString", coordinates: cometSlice(r.points, t) }, properties: {} });
      features.push({ type: "Feature", geometry: { type: "LineString", coordinates: cometSlice(r.points, tTrail) }, properties: {} });
    });
    return { type: "FeatureCollection", features };
  }

  let rafId = null;
  function frame(tsMs) {
    const src = map.getSource("hub-comets");
    if (src) src.setData(cometsFC(tsMs / 1000));
    rafId = requestAnimationFrame(frame);
  }

  map.on("load", () => {
    const beforeId = map.getLayer("hubs") ? "hubs" : undefined;

    map.addSource("hub-routes-baseline", { type: "geojson", data: baselineFC() });
    map.addSource("hub-comets", { type: "geojson", data: cometsFC(0) });

    // Faint static baseline - the routes stay barely visible even between pulses.
    map.addLayer({
      id: "hub-routes-baseline", type: "line", source: "hub-routes-baseline",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#a78bfa", "line-width": 1, "line-opacity": 0.1 }
    }, beforeId);

    // Glow: thick, blurred, violet/cyan.
    map.addLayer({
      id: "hub-comets-glow", type: "line", source: "hub-comets",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#3fd6e8", "line-width": 6, "line-blur": 4, "line-opacity": 0.6 }
    }, beforeId);

    // Core: thin, bright white-cyan.
    map.addLayer({
      id: "hub-comets-core", type: "line", source: "hub-comets",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#eafcff", "line-width": 1.5, "line-opacity": 0.95 }
    }, beforeId);

    rafId = requestAnimationFrame(frame);
  });
})();
