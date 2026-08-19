/* ==========================================================================
   H2ELIOS · True 3D elevated arcs + raised pipeline conduits
   Raw WebGL2, via MapLibre's CustomLayerInterface — no Deck.gl/Three.js.
   Native `line`/`fill-extrusion` layers drape to the map surface; this
   bypasses that entirely by writing straight to the GPU. Each route is a
   triangle-strip "ribbon" whose vertices are lifted off the globe surface
   in the vertex shader, then projected through MapLibre's own
   projectTileFor3D() — injected per-frame via
   shaderDescription.vertexShaderPrelude, the officially supported v5
   mechanism for custom layers that must stay correct under BOTH the globe
   and mercator projections (it interpolates the two automatically across
   the globe->mercator zoom transition around z12, which a hand-rolled
   projection matrix would not do for this app's globe view).

   TWO route classes, because they are two different physical things and
   drawing them the same way would be a lie:

     · CORRIDORS (D.flows) — contractual supply-chain relationships between
       two sites, e.g. NEOM -> Rotterdam ammonia. Nothing physical connects
       them, so these are drawn as great-circle arcs sweeping high above
       the globe, apex scaled by real distance.

     · PIPELINES (D.pipelines) — actual buried/laid steel with a surveyed
       right-of-way. These follow their REAL polyline vertex-for-vertex
       (densified along each segment by great-circle interpolation so long
       spans bend with the globe instead of cutting through it) and sit on
       a low flat plateau just above the surface. They read as raised
       conduits tracing the true route, never as arcs through the sky —
       an arc here would put the pipe hundreds of km from where it is.

   Elevation is computed per-vertex on the CPU and uploaded in metres, so
   the shader needs no branch to tell the two profiles apart.

   Wired to the existing "flows" and "pipelines" dock controls: each 3D
   class is simply how its already-toggled dataset looks in 3D.
   ======================================================================= */
(function () {
  const ARC_STEPS = 96;          // samples along a corridor great circle
  const PIPE_STEP_KM = 25;       // target spacing when densifying a pipeline segment
  const FLOATS_PER_VERTEX = 9;
  const VERTEX_STRIDE = FLOATS_PER_VERTEX * 4;

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function smoothstep(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function toRad(d) { return (d * Math.PI) / 180; }
  function toDeg(r) { return (r * 180) / Math.PI; }

  // Each 3D class follows the dock control for its own dataset: "flows" drives
  // the corridors (it already drives the draped 2D flow lines rendering the
  // same D.flows), "pipelines" drives the raised conduits (same, for the draped
  // pipeline lines). A custom-type layer has no setLayoutProperty visibility
  // switch for TOGGLE_MAP to drive, so this reads the control directly.
  //
  // Polled per frame rather than bound with a click listener on purpose:
  // wireDock() in 03-filters.js is what flips the .active class, and it
  // registers its handler inside 01-core.js's map "load" callback — after this
  // module parses. A listener added here would therefore fire FIRST and read
  // the class from before the toggle, inverting every switch. render() already
  // runs every frame for the traveling pulse, so reading the live class there
  // is correct regardless of listener order and needs no state to keep in sync.
  const dockCache = {};
  function dockOn(layerKey) {
    if (!dockCache[layerKey]) dockCache[layerKey] = document.querySelector(`.dock-btn[data-layer="${layerKey}"]`);
    const btn = dockCache[layerKey];
    return btn ? btn.classList.contains("active") : true;
  }

  function hexToRgb01(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  // Status dims the route rather than recolouring it: colour already encodes
  // the hydrogen taxonomy (green/blue/pink/...) and must stay readable. Under
  // additive blending, scaling RGB scales the emitted light, so this is a
  // brightness control that needs no extra vertex attribute.
  const STATUS_GAIN = { operating: 1.0, construction: 0.85, planned: 0.62, atrisk: 0.45, other: 0.7 };

  // Spherical linear interpolation (great-circle), same technique already
  // validated for the comet-pulse hub routes in 18-api-live.js.
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

  function pathLengthKm(lngLats) {
    let km = 0;
    for (let i = 1; i < lngLats.length; i++) km += kmDist(lngLats[i - 1], lngLats[i]);
    return km;
  }

  // Cumulative arc-length parameterisation. Using distance rather than vertex
  // index means the traveling pulse moves at a constant ground speed even on a
  // polyline whose segments are wildly uneven (the Gulf Coast network has a
  // 140km leg next to a 25km one).
  function progressAlong(lngLats) {
    const cum = [0];
    for (let i = 1; i < lngLats.length; i++) cum.push(cum[i - 1] + kmDist(lngLats[i - 1], lngLats[i]));
    const total = cum[cum.length - 1] || 1;
    return cum.map((c) => c / total);
  }

  // ---- Route builders -----------------------------------------------------

  // Multiple corridors that share (or nearly share) a hub endpoint collapse
  // to the same screen point near that hub and cross each other on the way
  // in — a Rotterdam scene with two unrelated corridors ("NEOM -> global
  // ammonia" and "Egypt Green -> Rotterdam") read as one bent/kinked arc
  // even though each individual great circle is mathematically smooth. Fix:
  // cluster flow endpoints that sit within HUB_CLUSTER_KM of each other,
  // and for any cluster with 2+ members, fan each corridor's approach out
  // sideways by a small offset that is exactly zero at the true hub point
  // (so it still terminates at the real location) and zero at its own far
  // end, peaking partway along the approach. The corridors now read as
  // separate spokes converging on one point instead of overlapping strands.
  const HUB_CLUSTER_KM = 8;

  const hubClusters = [];
  function hubFor(coord) {
    for (const c of hubClusters) {
      if (kmDist(coord, c.at) < HUB_CLUSTER_KM) return c;
    }
    const c = { at: coord, members: [] };
    hubClusters.push(c);
    return c;
  }
  D.flows.forEach((flow, idx) => {
    hubFor(flow.from).members.push({ idx, end: "from" });
    hubFor(flow.to).members.push({ idx, end: "to" });
  });
  const fanIndex = {};
  hubClusters.forEach((c) => {
    if (c.members.length < 2) return;
    c.members.forEach((m, i) => { fanIndex[`${m.idx}:${m.end}`] = { i, n: c.members.length }; });
  });

  function fanOffsetKm(flowIdx, end, distKm) {
    const f = fanIndex[`${flowIdx}:${end}`];
    if (!f) return 0;
    const spacing = clamp(distKm * 0.03, 20, 220);
    return (f.i - (f.n - 1) / 2) * spacing;
  }

  // 0 at the true hub point and at the far end, peaks a third of the way in.
  function fanBump(end, t) {
    if (end === "to") return t <= 0.5 ? 0 : Math.sin(((t - 0.5) / 0.5) * Math.PI);
    return t >= 0.5 ? 0 : Math.sin(((0.5 - t) / 0.5) * Math.PI);
  }

  function bearingBetween(a, b) {
    const lat1 = toRad(a[1]), lat2 = toRad(b[1]), dLng = toRad(b[0] - a[0]);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return toDeg(Math.atan2(y, x));
  }

  function destPoint(lngLat, bearingDeg, distKm) {
    const R = 6371;
    const lat1 = toRad(lngLat[1]), lng1 = toRad(lngLat[0]), brng = toRad(bearingDeg), dR = distKm / R;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dR) + Math.cos(lat1) * Math.sin(dR) * Math.cos(brng));
    const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(dR) * Math.cos(lat1), Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2));
    return [toDeg(lng2), toDeg(lat2)];
  }

  function fanOutPath(flowIdx, distKm, lngLats, t) {
    const offFrom = fanOffsetKm(flowIdx, "from", distKm);
    const offTo = fanOffsetKm(flowIdx, "to", distKm);
    if (!offFrom && !offTo) return lngLats;
    const last = lngLats.length - 1;
    return lngLats.map((p, i) => {
      const amt = offFrom * fanBump("from", t[i]) + offTo * fanBump("to", t[i]);
      if (!amt) return p;
      const prev = lngLats[Math.max(0, i - 1)], next = lngLats[Math.min(last, i + 1)];
      return destPoint(p, bearingBetween(prev, next) + 90, amt);
    });
  }

  // A contractual corridor: pure great circle, sine elevation profile. Apex
  // height and ribbon width scale with real distance, so a ~5km on-site link
  // reads as a small bump and a ~9,000km intercontinental one as a sweeping
  // arc. Floor raised 40,000 -> 90,000: on-site corridors like ACES's own
  // internal links (sub-1km) were hitting the OLD floor regardless of their
  // real distance, and 40km of apex over a <1km base rendered as barely a
  // ripple at globe scale — not visibly an arc at all. 90km keeps the same
  // proportional-to-distance formula for everything above it, just raises
  // the floor enough that the shortest corridors read as an actual parabola
  // rather than a near-flat line.
  function corridorRoute(flow, idx) {
    const distKm = kmDist(flow.from, flow.to);
    const apex = clamp(distKm * 260, 90000, 2400000);
    const lngLats = [];
    for (let i = 0; i <= ARC_STEPS; i++) lngLats.push(slerp(flow.from, flow.to, i / ARC_STEPS));
    const t = progressAlong(lngLats);
    return {
      kind: "corridor",
      lngLats: fanOutPath(idx, distKm, lngLats, t),
      progress: t,
      elevations: t.map((f) => Math.sin(f * Math.PI) * apex),
      halfWidth: clamp(apex / 1.6e9, 0.00035, 0.0016),
      wave: clamp(distKm / 260, 3, 22),
      colorRGB: hexToRgb01(COLORS[flow.color] || COLORS.gray_blue),
      sourceProps: flow // sparse — {name, color, from, to} — kept for click hit-testing (see bindHitTesting)
    };
  }

  // A real pipeline: the reported LineString, densified so each segment is
  // sampled roughly every PIPE_STEP_KM along its great circle. The vertices
  // themselves are never moved — only subdivided — so the conduit sits exactly
  // on the surveyed route.
  function densify(coords) {
    const out = [coords[0]];
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1], b = coords[i];
      const steps = Math.max(2, Math.ceil(kmDist(a, b) / PIPE_STEP_KM));
      for (let s = 1; s <= steps; s++) out.push(slerp(a, b, s / steps));
    }
    return out;
  }

  function pipelineRoute(feature) {
    const p = feature.properties;
    const lngLats = densify(feature.geometry.coordinates);
    const lengthKm = pathLengthKm(lngLats);
    // Deliberately small: a pipeline is on the ground. The lift is only enough
    // to separate the conduit from the draped 2D line beneath it and give it a
    // readable body in 3D — it is a rendering convention, not a claim about
    // elevation.
    const lift = clamp(lengthKm * 110, 12000, 160000);
    const t = progressAlong(lngLats);
    const gain = STATUS_GAIN[p.statusClass] || STATUS_GAIN.other;
    const rgb = hexToRgb01(COLORS[p.color] || COLORS.gray_blue);
    return {
      kind: "pipeline",
      lngLats,
      progress: t,
      // Flat plateau with soft ramps at each end: the conduit rises out of the
      // terminal and runs level, instead of arcing away from its own route.
      elevations: t.map((f) => lift * smoothstep(0, 0.10, f) * smoothstep(0, 0.10, 1 - f)),
      halfWidth: clamp(lengthKm * 4e-7, 0.00030, 0.00075),
      wave: clamp(lengthKm / 260, 2, 14),
      colorRGB: [rgb[0] * gain, rgb[1] * gain, rgb[2] * gain],
      sourceProps: p // full facility-style properties — same object the draped 2D "pipelines" layer's own click handler uses
    };
  }

  // ---- Geometry -----------------------------------------------------------

  // Builds one triangle-strip ribbon. Each along-path sample contributes 2
  // vertices (left/right of the travel direction), interleaved as
  // [mercatorX, mercatorY, progress, side, r, g, b, elevationMetres, waveCount].
  // progress (0..1) drives the fragment shader's endpoint fade and pulse phase;
  // side (-1..+1) drives the cross-beam glow falloff; the rest are baked
  // per-route constants carried on every vertex so render() can draw every
  // route from one uniform state.
  function buildRibbon(route) {
    const { lngLats, progress, elevations, halfWidth, colorRGB, wave } = route;
    const merc = lngLats.map((p) => maplibregl.MercatorCoordinate.fromLngLat({ lng: p[0], lat: p[1] }));
    const last = merc.length - 1;
    const verts = [];
    for (let i = 0; i <= last; i++) {
      const prev = merc[Math.max(0, i - 1)], next = merc[Math.min(last, i + 1)];
      let dx = next.x - prev.x, dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1e-9;
      dx /= len; dy /= len;
      const nx = -dy, ny = dx; // perpendicular to travel direction, in the mercator plane
      const p = merc[i], t = progress[i], e = elevations[i];
      verts.push(p.x + nx * halfWidth, p.y + ny * halfWidth, t, 1, colorRGB[0], colorRGB[1], colorRGB[2], e, wave);
      verts.push(p.x - nx * halfWidth, p.y - ny * halfWidth, t, -1, colorRGB[0], colorRGB[1], colorRGB[2], e, wave);
    }
    return new Float32Array(verts);
  }

  const CORRIDORS = D.flows.map((flow, idx) => corridorRoute(flow, idx));
  const PIPELINES = D.pipelines.features
    .filter((f) => f.geometry && f.geometry.type === "LineString" && f.geometry.coordinates.length > 1)
    .map(pipelineRoute);

  const arcLayer = {
    id: "h2grid-3d-arcs",
    type: "custom",
    renderingMode: "3d", // conformal z: equal world lengths render as cubes, so the elevation reads as real height
    shaderMap: new Map(),
    buffers: [],

    getShader(gl, shaderDescription) {
      if (this.shaderMap.has(shaderDescription.variantName)) return this.shaderMap.get(shaderDescription.variantName);

      // projectTileFor3D(vec2 posInTile, float elevationMeters) is injected
      // by vertexShaderPrelude — under globe projection, elevationMeters is
      // meters above the sphere surface; under mercator, above the ground
      // plane. It also handles the globe<->mercator transition blend, so
      // this shader needs no projection-mode branching of its own.
      const vertexSource = `#version 300 es
${shaderDescription.vertexShaderPrelude}
${shaderDescription.define}

in vec2 a_pos;
in float a_progress;
in float a_side;
in vec3 a_color;
in float a_elevation;
in float a_wave;

out float v_progress;
out float v_side;
out vec3 v_color;
out float v_wave;

void main() {
  gl_Position = projectTileFor3D(a_pos, a_elevation);
  v_progress = a_progress;
  v_side = a_side;
  v_color = a_color;
  v_wave = a_wave;
}`;

      const fragmentSource = `#version 300 es
precision highp float;

in float v_progress;
in float v_side;
in vec3 v_color;
in float v_wave;

uniform float u_time;
uniform float u_lightMode;

out vec4 fragColor;

void main() {
  // Cross-beam glow: bright core at the centerline, soft transparent fade
  // toward the ribbon's outer edge — a glowing energy beam, not a flat,
  // hard-edged, "solid plastic tube" ribbon.
  float cross = 1.0 - smoothstep(0.0, 1.0, abs(v_side));
  float core = pow(cross, 3.0);

  // Endpoint fade: the beam grows out of / fades into each hub instead of
  // starting and ending with a hard-cut edge.
  float endFade = smoothstep(0.0, 0.06, v_progress) * smoothstep(0.0, 0.06, 1.0 - v_progress);

  // Traveling brightness pulse. The wave count is baked per route from its
  // real length, so a 32km pipeline shows two slow pulses instead of the same
  // 18 crammed into a few pixels as a 9,000km corridor.
  float pulse = 0.5 + 0.5 * sin(v_progress * v_wave - u_time * 2.2);

  float alpha = (cross * 0.55 + core * 0.45) * endFade * (0.65 + 0.35 * pulse);
  vec3 color = v_color * (0.8 + 0.6 * pulse);
  color = mix(color, color * 0.38, u_lightMode);
  alpha *= mix(1.0, 0.76, u_lightMode);
  fragColor = vec4(color, alpha);
}`;

      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, vertexSource);
      gl.compileShader(vs);
      if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) console.error("h2grid-3d-arcs vertex shader:", gl.getShaderInfoLog(vs));

      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, fragmentSource);
      gl.compileShader(fs);
      if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) console.error("h2grid-3d-arcs fragment shader:", gl.getShaderInfoLog(fs));

      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) console.error("h2grid-3d-arcs program link:", gl.getProgramInfoLog(program));

      this.shaderMap.set(shaderDescription.variantName, program);
      return program;
    },

    onAdd(_map, gl) {
      this.buffers = CORRIDORS.concat(PIPELINES).map((route) => {
        const data = buildRibbon(route);
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        return { vbo, kind: route.kind, count: data.length / FLOATS_PER_VERTEX };
      });
    },

    render(gl, args) {
      // Pipelines belong to 19-pipeline-ribbons.js now. That module renders the
      // same D.pipelines routes as a raised conduit with a top face and side
      // walls, so drawing them here too would double the geometry and let two
      // modules disagree about the same right-of-way. This layer keeps the
      // corridors, which nothing else draws: they are contractual supply
      // relationships with no physical route, and the sweeping arc is what
      // distinguishes them from surveyed steel.
      const show = { corridor: dockOn("flows"), pipeline: false };
      if (!show.corridor) return;

      const program = this.getShader(gl, args.shaderData);
      gl.useProgram(program);

      const pd = args.defaultProjectionData;
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_projection_fallback_matrix"), false, pd.fallbackMatrix);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_projection_matrix"), false, pd.mainMatrix);
      gl.uniform4f(gl.getUniformLocation(program, "u_projection_tile_mercator_coords"), pd.tileMercatorCoords[0], pd.tileMercatorCoords[1], pd.tileMercatorCoords[2], pd.tileMercatorCoords[3]);
      gl.uniform4f(gl.getUniformLocation(program, "u_projection_clipping_plane"), pd.clippingPlane[0], pd.clippingPlane[1], pd.clippingPlane[2], pd.clippingPlane[3]);
      gl.uniform1f(gl.getUniformLocation(program, "u_projection_transition"), pd.projectionTransition);

      const lightTheme = h2eliosLightMode;
      gl.uniform1f(gl.getUniformLocation(program, "u_time"), performance.now() / 1000);
      gl.uniform1f(gl.getUniformLocation(program, "u_lightMode"), lightTheme ? 1 : 0);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, lightTheme ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE);
      gl.depthFunc(gl.LEQUAL);

      const aPos = gl.getAttribLocation(program, "a_pos");
      const aProgress = gl.getAttribLocation(program, "a_progress");
      const aSide = gl.getAttribLocation(program, "a_side");
      const aColor = gl.getAttribLocation(program, "a_color");
      const aElevation = gl.getAttribLocation(program, "a_elevation");
      const aWave = gl.getAttribLocation(program, "a_wave");

      this.buffers.forEach((buf) => {
        if (!show[buf.kind]) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.vbo);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, VERTEX_STRIDE, 0);
        gl.enableVertexAttribArray(aProgress);
        gl.vertexAttribPointer(aProgress, 1, gl.FLOAT, false, VERTEX_STRIDE, 2 * 4);
        gl.enableVertexAttribArray(aSide);
        gl.vertexAttribPointer(aSide, 1, gl.FLOAT, false, VERTEX_STRIDE, 3 * 4);
        gl.enableVertexAttribArray(aColor);
        gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, VERTEX_STRIDE, 4 * 4);
        gl.enableVertexAttribArray(aElevation);
        gl.vertexAttribPointer(aElevation, 1, gl.FLOAT, false, VERTEX_STRIDE, 7 * 4);
        gl.enableVertexAttribArray(aWave);
        gl.vertexAttribPointer(aWave, 1, gl.FLOAT, false, VERTEX_STRIDE, 8 * 4);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, buf.count);
      });

      // An unconditional repaint here held the whole map at full frame rate
      // forever, which is why this module was cut in the ambient-motion pass.
      // The pulse now runs only when the same policy gate the rest of the globe
      // obeys says motion is allowed; otherwise u_time stops advancing and the
      // arcs hold still, costing nothing.
      if (typeof ambientMotionAllowed === "function" && ambientMotionAllowed()) map.triggerRepaint();
    }
  };

  // map.on("load") alone is a one-shot that is missed whenever the style
  // finishes before this module parses — the failure mode that silently left
  // the spike layer unadded in 20-spikes.js. isStyleLoaded() is the correct
  // readiness test, with "styledata" as a net for later style changes.
  function addArcLayer() {
    if (!map.getLayer(arcLayer.id)) map.addLayer(arcLayer);
  }
  if (map.isStyleLoaded()) addArcLayer();
  map.on("load", addArcLayer);
  map.on("styledata", addArcLayer);

  // ---- Click hit-testing --------------------------------------------------
  // Custom WebGL layers aren't hit-testable by MapLibre's own picking — a
  // click always misses the visible 3D beam. The draped 2D "flows-base"/
  // "pipelines" lines these arcs are drawn FROM are already clickable
  // (js/05-detail.js wireClicks()), but they're thin and sit at ground
  // level while the beam floats well above them, so a click aimed at the
  // thing a user can actually see usually misses the real hit target
  // entirely.
  //
  // This approximates a hit by testing screen-space distance from the click
  // to each route's GROUND track (ignoring the beam's elevation — properly
  // projecting an elevated point under globe projection would mean
  // reimplementing MapLibre's own projection matrices, which the custom
  // layer receives per-frame but a normal click handler has no access to).
  // A generous pixel tolerance stands in for that missing elevation
  // awareness: not a pixel-accurate pick on the beam itself, but a real
  // click near a corridor/pipeline's path now does something, where before
  // it did nothing at all. Only runs when the click didn't already land on
  // a real clickable layer, so this never steals a click from a marker.
  const HIT_TOLERANCE_PX = 16;
  const CLICKABLE_LAYERS = ["upstream", "production", "manufacturing", "storage", "pipelines", "endUse", "fuelingStations", "hubs", "flows-base"];

  function distToSegment(p, a, b) {
    const abx = b.x - a.x, aby = b.y - a.y;
    const len2 = abx * abx + aby * aby;
    let t = len2 > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const x = a.x + t * abx, y = a.y + t * aby;
    return Math.hypot(p.x - x, p.y - y);
  }

  function nearestRouteAt(point) {
    let best = null, bestDist = HIT_TOLERANCE_PX;
    CORRIDORS.concat(PIPELINES).forEach((route) => {
      if (!dockOn(route.kind === "corridor" ? "flows" : "pipelines")) return;
      const pts = route.lngLats.map((ll) => map.project(ll));
      for (let i = 1; i < pts.length; i++) {
        const d = distToSegment(point, pts[i - 1], pts[i]);
        if (d < bestDist) { bestDist = d; best = route; }
      }
    });
    return best;
  }

  map.on("click", (e) => {
    // Not e.defaultPrevented — MapLibre's own click event doesn't reliably
    // carry that signal across its layer-specific vs. general handlers.
    // queryRenderedFeatures at the same point is the certain way to know
    // whether a real layer (and therefore its own wireClicks() handler) was
    // actually under the cursor, independent of handler dispatch order.
    const hits = map.queryRenderedFeatures(e.point, { layers: CLICKABLE_LAYERS.filter((id) => map.getLayer(id)) });
    if (hits.length) return; // a real layer was clicked — its own handler already ran
    const route = nearestRouteAt(e.point);
    if (route && typeof selectFacility === "function") selectFacility(route.sourceProps, [e.lngLat.lng, e.lngLat.lat]);
  });

  // Exposed for verification and other scripted consumers.
  window.H2GArcs = {
    debug() {
      return {
        corridors: CORRIDORS.length,
        pipelines: PIPELINES.length,
        buffers: arcLayer.buffers.length,
        visible: { corridor: dockOn("flows"), pipeline: dockOn("pipelines") },
        pipelineSamples: PIPELINES.map((r) => ({
          points: r.lngLats.length,
          lengthKm: Math.round(pathLengthKm(r.lngLats)),
          maxLiftM: Math.round(Math.max.apply(null, r.elevations))
        }))
      };
    }
  };
})();
