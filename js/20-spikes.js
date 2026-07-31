/* ==========================================================================
   H2Grid · True 3D capacity spikes (globe-safe)
   Raw WebGL2 via MapLibre's CustomLayerInterface — same technique as
   19-command-arcs.js, and for the same reason: MapLibre 5.24 draws
   `fill-extrusion` footprints under globe projection but IGNORES
   fill-extrusion-height, so extruded bars drape flat to the sphere. Verified
   with an isolated probe — identical code and version, globe renders a flat
   polygon, mercator+pitch renders a real bar. Anything that must stand OFF
   the globe has to go through the GPU path.

   Each project is a square prism whose apex is lifted in the vertex shader by
   projectTileFor3D(posInTile, elevationMeters), injected per-frame via
   shaderDescription.vertexShaderPrelude — the supported v5 mechanism that
   stays correct under BOTH globe and mercator and blends across the
   globe->mercator transition near z12.

   Fed from data that ships in the repo (curated D.production/D.storagePoints
   plus IEA when that layer is on), NOT from /api — the hero visual must not
   go dark on a static host, which is exactly how api-projects-extrusion
   fails today.

   Load order: after 17-visualization.js (which owns COLOR_HEX_MAP,
   getCapacityMw and the #dock-3d-btn toggle that drives this).
   ======================================================================= */
(function () {
  // Same exponent/clamp rationale as 18-api-live.js:172-181 — the IEA dataset
  // carries a ~10.7M "MW" ETL artifact from the kt-H2/yr conversion, which
  // unclamped would produce a spike many times Earth's radius.
  // Sized so the clamp ceiling actually reaches MAX_HEIGHT: 4000^0.45 ≈ 41.5,
  // and 41.5 * 38000 ≈ 1.58M m. The previous 6000 topped out around 249km, so
  // every spike sat pinned at MIN_HEIGHT and MAX_HEIGHT was unreachable —
  // raising the ceiling did nothing at all until this was fixed with it.
  const HEIGHT_FACTOR = 62000;   // meters per (clamped capacityMw ^ exponent)
  const HEIGHT_EXPONENT = 0.45;  // flat enough that outliers don't eclipse dense clusters
  const CLAMP_MW = 4000;         // covers the largest legitimate projects
  // Aspect ratio is what sells this, not absolute size. The reference look
  // (Will Su's "Refugee Flow") is hair-thin needles at an extreme height:width
  // ratio, dense enough that a cluster reads as fur on the sphere. Thickening
  // the beams to make them "more visible" backfires — they become stubby blocks
  // and the cluster turns into a solid mass. Height carries the visibility;
  // width stays near-minimal.
  // The floor is deliberately low. At 220km, 49 of the 84 curated projects
  // landed on it — identical height, which read as uniform stubble instead of
  // the organic varied grass the reference gets. A low floor lets capacity
  // actually differentiate: a 10MW site is a stub, a 4GW one towers.
  const MIN_HEIGHT = 110000;     // 110km
  const MAX_HEIGHT = 2600000;    // 2,600km — ~41% of Earth's radius, deliberately non-physical

  // Base width, not uniform width — the prism tapers to a point in the vertex
  // shader (TIP_TAPER), so this can be chunky at the ground without the whole
  // beam reading as a fat block.
  const BASE_HALF_WIDTH = 0.00060; // mercator [0,1] units at the reference zoom
  const TIP_TAPER = 0.94;          // fraction of base width removed by the apex
  const REFERENCE_ZOOM = 3;

  // A spike sized for globe zoom is absurd at street zoom, so both height and
  // width shrink with zoom rather than being tuned for one camera distance —
  // the specific failure of the existing "Spikey Earth" constants.
  // Mercator world size doubles per zoom level, so an exponent of 1.0 holds a
  // spike at constant apparent size. Slightly above 1.0 lets spikes recede as
  // you zoom in, which keeps a dense cluster readable instead of turning into
  // a wall of beams that fills the viewport (measured at z7/pitch 55).
  // Mercator world size doubles per zoom, so exponent 1.0 would hold a spike at
  // constant *screen* size. That still overwhelms the view once the ground
  // fills the viewport, so the falloff is deliberately steeper than 1.0: spikes
  // recede as you zoom in, staying a globe-scale readout rather than becoming a
  // wall of beams over a city (measured at z7/pitch 55, which produced exactly
  // that before this was tightened).
  function heightScaleFor(zoom) {
    return Math.min(1, Math.max(0.012, Math.pow(2, -(zoom - REFERENCE_ZOOM) * 1.18)));
  }
  function halfWidthFor(zoom) {
    return BASE_HALF_WIDTH * Math.min(1, Math.max(0.008, Math.pow(2, -(zoom - REFERENCE_ZOOM) * 1.15)));
  }
  // Full strength out to z3.5 (the globe view this layer exists for), easing off
  // where overlapping beams would blow out. The floor stays well above zero:
  // dropping to a quarter made spikes almost invisible once zoomed in, which is
  // worse than a little saturation.
  function alphaScaleFor(zoom) {
    const t = Math.min(1, Math.max(0, (zoom - 3.5) / 3));
    return 1 - 0.30 * t;
  }

  function hexToRgb01(hex) {
    const n = parseInt(String(hex).slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  function spikeHeight(capacityMw) {
    const mw = Math.min(Math.max(Number(capacityMw) || 1, 1), CLAMP_MW);
    return Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.pow(mw, HEIGHT_EXPONENT) * HEIGHT_FACTOR));
  }

  // 10 floats/vertex: center is kept separate from the corner offset so the
  // shader can rescale width per-zoom without rebuilding the buffer.
  // [ cx, cy, ox, oy, top, face, r, g, b, height ]
  const FLOATS_PER_VERTEX = 10;
  const VERTEX_STRIDE = FLOATS_PER_VERTEX * 4;

  // Square cross-section, corners at 45° so a face points at the camera in the
  // app's default bearing rather than an edge.
  const CORNERS = [0, 1, 2, 3].map((i) => {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    return [Math.cos(a), Math.sin(a)];
  });

  function buildVertices(spikes) {
    const verts = new Float32Array(spikes.length * 24 * FLOATS_PER_VERTEX);
    let k = 0;

    for (const s of spikes) {
      const m = maplibregl.MercatorCoordinate.fromLngLat({ lng: s.lng, lat: s.lat });
      const [r, g, b] = s.rgb;
      const h = s.height;

      const push = (corner, top) => {
        verts[k++] = m.x; verts[k++] = m.y;
        verts[k++] = CORNERS[corner][0]; verts[k++] = CORNERS[corner][1];
        verts[k++] = top; verts[k++] = corner;
        verts[k++] = r; verts[k++] = g; verts[k++] = b;
        verts[k++] = h;
      };

      // Four side faces, two triangles each.
      for (let i = 0; i < 4; i++) {
        const a = i, c = (i + 1) % 4;
        push(a, 0); push(a, 1); push(c, 0);
        push(a, 1); push(c, 1); push(c, 0);
      }
    }
    return verts;
  }

  let pendingSpikes = null;

  const spikeLayer = {
    id: "h2grid-3d-spikes",
    type: "custom",
    renderingMode: "3d",
    shaderMap: new Map(),
    visible: false,
    gl: null,
    vbo: null,
    vertexCount: 0,

    getShader(gl, shaderDescription) {
      if (this.shaderMap.has(shaderDescription.variantName)) return this.shaderMap.get(shaderDescription.variantName);

      const vertexSource = `#version 300 es
${shaderDescription.vertexShaderPrelude}
${shaderDescription.define}

in vec2 a_center;
in vec2 a_offset;
in float a_top;
in float a_face;
in vec3 a_color;
in float a_height;

uniform float u_halfWidth;
uniform float u_heightScale;
uniform float u_tipTaper;

out float v_top;
out float v_face;
out vec3 v_color;

void main() {
  // Taper: full width at the base, near-zero at the apex, so the prism becomes
  // a spike that comes to a point rather than a constant-width bar with a flat
  // cap. The narrowing also makes the alpha falloff read as a fade-out instead
  // of the beam simply stopping.
  float width = u_halfWidth * (1.0 - a_top * u_tipTaper);
  vec2 pos = a_center + a_offset * width;
  float elevation = a_top * a_height * u_heightScale;
  gl_Position = projectTileFor3D(pos, elevation);
  v_top = a_top;
  v_face = a_face;
  v_color = a_color;
}`;

      const fragmentSource = `#version 300 es
precision highp float;

in float v_top;
in float v_face;
in vec3 v_color;

uniform float u_alphaScale;

out vec4 fragColor;

void main() {
  // Three stacked falloffs rather than one linear ramp, so the spike reads as
  // emitted light with structure instead of a bar that simply gets fainter:
  //   core  — tight, hot concentration right at the project's location
  //   taper — long gentle fade carrying colour most of the way up
  //   tip   — faint spark at the apex so the beam ends on a highlight rather
  //           than dissolving into nothing
  float up    = clamp(v_top, 0.0, 1.0);
  float down  = 1.0 - up;
  float core  = pow(down, 3.0);
  // Deliberately shallow: a needle needs to stay bright most of its length or
  // it reads as a short stub with a faint smear above it. The fade is saved
  // for the last stretch near the apex, where the geometry is also narrowing
  // to a point — the two together give a clean dissolve rather than a cut.
  float taper = pow(down, 0.30);
  float tip   = 0.0;

  // Scaled by u_alphaScale rather than fixed. Blending is additive, so the
  // usable alpha depends entirely on how many beams overlap on screen: at
  // globe zoom few overlap and a bold alpha gives the layer its impact, but
  // by z6 a pitched view through Europe stacks hundreds and the same alpha
  // saturates to a flat white wall, destroying the density read that is the
  // whole point of the layer. Both were measured; neither single value works.
  float alpha = (0.09 + 0.48 * taper + 0.26 * core + tip) * u_alphaScale;

  // Per-face brightness so adjacent faces separate and the prism reads as a
  // form instead of a flat silhouette.
  float facing = 0.72 + 0.28 * abs(cos(v_face * 1.5707963));

  // No white mix at all. Under additive blending a dense region accumulates
  // toward white on its own, so any white pushed in here compounds and fuses
  // the cluster into a colourless mass — individual needles stop being
  // readable, which is the opposite of what the layer is for. Keeping the
  // taxonomy colour pure means a dense cluster reads as saturated green rather
  // than glare, and single needles stay distinguishable inside it.
  vec3 col = v_color * facing * (0.70 + 0.75 * taper);
  fragColor = vec4(col + vec3(tip * 0.5), alpha);
}`;

      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, vertexSource);
      gl.compileShader(vs);
      if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) console.error("h2grid-3d-spikes vertex shader:", gl.getShaderInfoLog(vs));

      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, fragmentSource);
      gl.compileShader(fs);
      if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) console.error("h2grid-3d-spikes fragment shader:", gl.getShaderInfoLog(fs));

      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) console.error("h2grid-3d-spikes program link:", gl.getProgramInfoLog(program));

      this.shaderMap.set(shaderDescription.variantName, program);
      return program;
    },

    onAdd(_map, gl) {
      this.gl = gl;
      this.vbo = gl.createBuffer();
      if (pendingSpikes) { this.upload(pendingSpikes); pendingSpikes = null; }
    },

    upload(spikes) {
      const gl = this.gl;
      if (!gl || !this.vbo) { pendingSpikes = spikes; return; }
      const data = buildVertices(spikes);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      this.vertexCount = data.length / FLOATS_PER_VERTEX;
    },

    render(gl, args) {
      if (!this.visible || !this.vertexCount) return;

      const program = this.getShader(gl, args.shaderData);
      gl.useProgram(program);

      const pd = args.defaultProjectionData;
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_projection_fallback_matrix"), false, pd.fallbackMatrix);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_projection_matrix"), false, pd.mainMatrix);
      gl.uniform4f(gl.getUniformLocation(program, "u_projection_tile_mercator_coords"), pd.tileMercatorCoords[0], pd.tileMercatorCoords[1], pd.tileMercatorCoords[2], pd.tileMercatorCoords[3]);
      gl.uniform4f(gl.getUniformLocation(program, "u_projection_clipping_plane"), pd.clippingPlane[0], pd.clippingPlane[1], pd.clippingPlane[2], pd.clippingPlane[3]);
      gl.uniform1f(gl.getUniformLocation(program, "u_projection_transition"), pd.projectionTransition);

      const zoom = map.getZoom();
      gl.uniform1f(gl.getUniformLocation(program, "u_halfWidth"), halfWidthFor(zoom));
      gl.uniform1f(gl.getUniformLocation(program, "u_heightScale"), heightScaleFor(zoom));
      gl.uniform1f(gl.getUniformLocation(program, "u_alphaScale"), alphaScaleFor(zoom));
      gl.uniform1f(gl.getUniformLocation(program, "u_tipTaper"), TIP_TAPER);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // additive — emissive light, matching the arc layer
      gl.depthFunc(gl.LEQUAL);

      const aCenter = gl.getAttribLocation(program, "a_center");
      const aOffset = gl.getAttribLocation(program, "a_offset");
      const aTop = gl.getAttribLocation(program, "a_top");
      const aFace = gl.getAttribLocation(program, "a_face");
      const aColor = gl.getAttribLocation(program, "a_color");
      const aHeight = gl.getAttribLocation(program, "a_height");

      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.enableVertexAttribArray(aCenter);
      gl.vertexAttribPointer(aCenter, 2, gl.FLOAT, false, VERTEX_STRIDE, 0);
      gl.enableVertexAttribArray(aOffset);
      gl.vertexAttribPointer(aOffset, 2, gl.FLOAT, false, VERTEX_STRIDE, 2 * 4);
      gl.enableVertexAttribArray(aTop);
      gl.vertexAttribPointer(aTop, 1, gl.FLOAT, false, VERTEX_STRIDE, 4 * 4);
      gl.enableVertexAttribArray(aFace);
      gl.vertexAttribPointer(aFace, 1, gl.FLOAT, false, VERTEX_STRIDE, 5 * 4);
      gl.enableVertexAttribArray(aColor);
      gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, VERTEX_STRIDE, 6 * 4);
      gl.enableVertexAttribArray(aHeight);
      gl.vertexAttribPointer(aHeight, 1, gl.FLOAT, false, VERTEX_STRIDE, 9 * 4);

      gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    }
  };

  // The spikes are the thing standing off the globe, so they must draw last.
  // The circle/glow marker layers are added by addPointLayer well after this
  // module registers its layer on style load, which put those soft clouds ON
  // TOP of the beams — the clouds read as fog in front of the spikes instead
  // of sitting behind them at ground level.
  function raiseToTop() {
    if (map.getLayer(spikeLayer.id)) map.moveLayer(spikeLayer.id);
  }

  // Public surface used by 17-visualization.js's #dock-3d-btn handler.
  window.H2GSpikes = {
    setData(points) {
      raiseToTop();
      spikeLayer.upload(points.map((p) => ({
        lng: p.lng, lat: p.lat, height: spikeHeight(p.capacityMw),
        rgb: hexToRgb01(p.colorHex || "#3fd6e8")
      })));
      if (typeof map !== "undefined") map.triggerRepaint();
    },
    setVisible(on) {
      spikeLayer.visible = !!on;
      if (on) raiseToTop();
      if (typeof map !== "undefined") map.triggerRepaint();
    },
    get count() { return spikeLayer.vertexCount / 24; },
    // Exposed for verification: the tallest spike's rendered height in metres
    // at the current zoom, so scaling can be measured rather than eyeballed.
    debugScale() {
      const z = map.getZoom();
      return { zoom: +z.toFixed(2), heightScale: +heightScaleFor(z).toFixed(4),
               maxRenderedMetres: Math.round(MAX_HEIGHT * heightScaleFor(z)),
               alphaScale: +alphaScaleFor(z).toFixed(3),
               halfWidthMercator: halfWidthFor(z) };
    }
  };

  // map.on("load") alone is a one-shot that is missed if the style finished
  // before this module parsed — which happens here, and left the layer never
  // added at all (silently: no error, just nothing renders). isStyleLoaded()
  // is the correct readiness test for addLayer, with "styledata" as a net for
  // any later style change that would drop a custom layer.
  function addSpikeLayer() {
    if (!map.getLayer(spikeLayer.id)) map.addLayer(spikeLayer);
  }
  if (map.isStyleLoaded()) addSpikeLayer();
  map.on("load", addSpikeLayer);

  // Re-assert the top position on every style change, not just when data is
  // set. addPointLayer and the IEA layer add their circle/glow layers during
  // the data load, which happens AFTER 3D auto-activates — so raising only on
  // setData/setVisible left those soft marker clouds back on top of the beams.
  map.on("styledata", () => { addSpikeLayer(); raiseToTop(); });
})();
