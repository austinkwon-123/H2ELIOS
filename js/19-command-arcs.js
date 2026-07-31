/* ==========================================================================
   H2Grid · True 3D elevated arcs (Command Center)
   Raw WebGL2, via MapLibre's CustomLayerInterface — no Deck.gl/Three.js.
   Native `line`/`fill-extrusion` layers drape to the map surface; this
   bypasses that entirely by writing straight to the GPU. Each arc is a
   triangle-strip "ribbon" whose vertices are lifted off the globe surface
   in the vertex shader by a sine elevation profile, then projected through
   MapLibre's own projectTileFor3D() — injected per-frame via
   shaderDescription.vertexShaderPrelude, the officially supported v5
   mechanism for custom layers that must stay correct under BOTH the globe
   and mercator projections (it interpolates the two automatically across
   the globe->mercator zoom transition around z12, which a hand-rolled
   projection matrix would not do for this app's globe view).

   Visualizes the app's real curated supply-chain corridors (D.flows, from
   data.js — the same dataset the 2D draped "flows" layer in 01-core.js
   already renders) rather than placeholder demo endpoints, so this is a
   true-3D upgrade of an existing real layer, not a decorative addition.
   Each route is colored by its own hydrogen-taxonomy color (COLORS, from
   01-core.js) and its apex height/width scale with the route's real
   great-circle distance (kmDist(), from 01-core.js) so a ~5km on-site
   corridor reads as a small bump and a ~9,000km intercontinental one reads
   as a sweeping arc, rather than every route getting identical geometry.

   Independent of the API-data pipeline; own dock toggle (data-layer=
   "commandArcs"), wired directly here since a custom-type layer has no
   setLayoutProperty visibility switch for TOGGLE_MAP to drive.
   ======================================================================= */
(function () {
  const ARC_STEPS = 96;

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

  function hexToRgb01(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  // Apex height and ribbon width scale with the route's real great-circle
  // distance: short on-site corridors get a small bump, long intercontinental
  // corridors get a tall, wide, sweeping arc.
  function paramsForDistance(distKm) {
    const height = clamp(distKm * 260, 40000, 2400000); // meters above the sphere surface
    const halfWidth = clamp(height / 1.6e9, 0.00035, 0.0016); // mercator [0,1] units
    return { height, halfWidth };
  }

  const ROUTES = D.flows.map((f) => {
    const { height, halfWidth } = paramsForDistance(kmDist(f.from, f.to));
    return { from: f.from, to: f.to, height, halfWidth, colorRGB: hexToRgb01(COLORS[f.color] || COLORS.gray_blue) };
  });

  function toRad(d) { return (d * Math.PI) / 180; }
  function toDeg(r) { return (r * 180) / Math.PI; }

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

  // Builds one triangle-strip ribbon for a single route. Each along-path
  // sample contributes 2 vertices (left/right of the travel direction),
  // interleaved as [mercatorX, mercatorY, progress, side, r, g, b, maxHeight].
  // progress (0..1) drives both the vertex shader's elevation profile and
  // the fragment shader's endpoint fade; side (-1..+1) drives the fragment
  // shader's cross-beam glow falloff; r/g/b/maxHeight are baked per-route
  // constants carried on every vertex so the shader needs no per-route
  // uniform (lets render() draw every route's buffer in one uniform state).
  function buildRibbon(route) {
    const { from, to, halfWidth, height, colorRGB } = route;
    const lngLats = [];
    for (let i = 0; i <= ARC_STEPS; i++) lngLats.push(slerp(from, to, i / ARC_STEPS));
    const merc = lngLats.map((p) => maplibregl.MercatorCoordinate.fromLngLat({ lng: p[0], lat: p[1] }));

    const verts = [];
    for (let i = 0; i <= ARC_STEPS; i++) {
      const t = i / ARC_STEPS;
      const prev = merc[Math.max(0, i - 1)], next = merc[Math.min(ARC_STEPS, i + 1)];
      let dx = next.x - prev.x, dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1e-9;
      dx /= len; dy /= len;
      const nx = -dy, ny = dx; // perpendicular to travel direction, in the mercator plane
      const p = merc[i];
      verts.push(p.x + nx * halfWidth, p.y + ny * halfWidth, t, 1, colorRGB[0], colorRGB[1], colorRGB[2], height);
      verts.push(p.x - nx * halfWidth, p.y - ny * halfWidth, t, -1, colorRGB[0], colorRGB[1], colorRGB[2], height);
    }
    return new Float32Array(verts);
  }

  const VERTEX_STRIDE = 8 * 4; // 8 floats * 4 bytes/float

  const arcLayer = {
    id: "h2grid-3d-arcs",
    type: "custom",
    renderingMode: "3d", // conformal z: equal world lengths render as cubes, so the sine elevation reads as real height
    shaderMap: new Map(),
    visible: true,
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
in float a_maxHeight;

out float v_progress;
out float v_side;
out vec3 v_color;

void main() {
  float elevation = sin(a_progress * 3.14159265) * a_maxHeight;
  gl_Position = projectTileFor3D(a_pos, elevation);
  v_progress = a_progress;
  v_side = a_side;
  v_color = a_color;
}`;

      const fragmentSource = `#version 300 es
precision highp float;

in float v_progress;
in float v_side;
in vec3 v_color;

uniform float u_time;

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

  // Traveling brightness pulse along the beam, so it reads as live energy
  // flow rather than a static glowing tube.
  float pulse = 0.5 + 0.5 * sin(v_progress * 18.0 - u_time * 2.2);

  float alpha = (cross * 0.55 + core * 0.45) * endFade * (0.65 + 0.35 * pulse);
  fragColor = vec4(v_color * (0.8 + 0.6 * pulse), alpha);
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
      this.buffers = ROUTES.map((route) => {
        const data = buildRibbon(route);
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
        return { vbo, count: data.length / 8 };
      });
    },

    render(gl, args) {
      if (!this.visible) return;

      const program = this.getShader(gl, args.shaderData);
      gl.useProgram(program);

      const pd = args.defaultProjectionData;
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_projection_fallback_matrix"), false, pd.fallbackMatrix);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_projection_matrix"), false, pd.mainMatrix);
      gl.uniform4f(gl.getUniformLocation(program, "u_projection_tile_mercator_coords"), pd.tileMercatorCoords[0], pd.tileMercatorCoords[1], pd.tileMercatorCoords[2], pd.tileMercatorCoords[3]);
      gl.uniform4f(gl.getUniformLocation(program, "u_projection_clipping_plane"), pd.clippingPlane[0], pd.clippingPlane[1], pd.clippingPlane[2], pd.clippingPlane[3]);
      gl.uniform1f(gl.getUniformLocation(program, "u_projection_transition"), pd.projectionTransition);

      gl.uniform1f(gl.getUniformLocation(program, "u_time"), performance.now() / 1000);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive — reads as glow, not a flat translucent ribbon
      gl.depthFunc(gl.LEQUAL);

      const aPos = gl.getAttribLocation(program, "a_pos");
      const aProgress = gl.getAttribLocation(program, "a_progress");
      const aSide = gl.getAttribLocation(program, "a_side");
      const aColor = gl.getAttribLocation(program, "a_color");
      const aMaxHeight = gl.getAttribLocation(program, "a_maxHeight");

      this.buffers.forEach((buf) => {
        gl.bindBuffer(gl.ARRAY_BUFFER, buf.vbo);
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, VERTEX_STRIDE, 0);
        gl.enableVertexAttribArray(aProgress);
        gl.vertexAttribPointer(aProgress, 1, gl.FLOAT, false, VERTEX_STRIDE, 2 * 4);
        gl.enableVertexAttribArray(aSide);
        gl.vertexAttribPointer(aSide, 1, gl.FLOAT, false, VERTEX_STRIDE, 3 * 4);
        gl.enableVertexAttribArray(aColor);
        gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, VERTEX_STRIDE, 4 * 4);
        gl.enableVertexAttribArray(aMaxHeight);
        gl.vertexAttribPointer(aMaxHeight, 1, gl.FLOAT, false, VERTEX_STRIDE, 7 * 4);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, buf.count);
      });

      map.triggerRepaint(); // keep the traveling pulse animating every frame
    }
  };

  map.on("load", () => {
    map.addLayer(arcLayer);

    // Driven by the single "flows" control now. The 3D arcs and the draped
    // 2D flow lines both render D.flows, so they were two switches for one
    // dataset; the arcs simply become how that dataset looks in 3D.
    const btn = document.querySelector('.dock-btn[data-layer="flows"]');
    if (btn) {
      btn.addEventListener("click", () => {
        arcLayer.visible = btn.classList.contains("active");
        map.triggerRepaint();
      });
    }
  });
})();
