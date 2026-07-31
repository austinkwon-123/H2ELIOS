/* ==========================================================================
   H2Grid · Day/night terminator shading
   Raw WebGL2 via MapLibre's CustomLayerInterface, same technique as
   19-command-arcs.js / 20-spikes.js.

   Fixes two things at once:

   1. map.setLight() (18-api-live.js) only affects fill-extrusion layers. The
      fill-extrusion towers were removed when the spikes moved to a custom
      WebGL layer, and api-projects-extrusion carries no data without the
      backend — so the existing sun code computes a light direction that
      nothing on screen actually uses.

   2. The NASA "Earth at Night" raster paints city lights across the WHOLE
      globe regardless of time of day, so cities glowed on the sunlit side.
      Raster layers have no spatial opacity control, so the fix is to draw
      over them: a daylight wash on the lit hemisphere dims those lights back
      down, while the night hemisphere gets darkened and lets them through.

   Why this belongs in a hydrogen map rather than being decoration: green
   hydrogen is made by electrolysis run off solar and wind, so the sunlit
   hemisphere IS the production window. The terminator is a real variable
   here, not an atmospheric effect.

   Draped at elevation 0 with renderingMode "2d", so it composites under the
   3D spikes and arcs without fighting the depth buffer.
   ======================================================================= */
(function () {
  const LAT_STEP = 3;   // degrees — 3° is smooth enough that the terminator
  const LNG_STEP = 4;   // reads as a curve, cheap enough to rebuild never
  const LAT_LIMIT = 84; // mercator y blows up at the poles

  // Twilight shaping, in cosine-of-solar-zenith. cosZ > 0 is lit, < 0 is dark;
  // the band between is civil/nautical twilight, which is what makes the
  // terminator read as a soft sweep instead of a hard cut.
  const NIGHT_START = 0.09;   // cosZ at which darkening begins
  const NIGHT_FULL = -0.30;   // cosZ at which darkening is at full strength
  const DAY_START = -0.02;
  const DAY_FULL = 0.34;

  const NIGHT_ALPHA = 0.74;
  const DAY_ALPHA = 0.17;

  function buildMesh() {
    const verts = [];
    const push = (lng, lat) => {
      const m = maplibregl.MercatorCoordinate.fromLngLat({ lng, lat });
      verts.push(m.x, m.y, lng, lat);
    };
    for (let lat = -LAT_LIMIT; lat < LAT_LIMIT; lat += LAT_STEP) {
      const lat2 = Math.min(lat + LAT_STEP, LAT_LIMIT);
      for (let lng = -180; lng < 180; lng += LNG_STEP) {
        const lng2 = lng + LNG_STEP;
        push(lng, lat);   push(lng2, lat);  push(lng, lat2);
        push(lng2, lat);  push(lng2, lat2); push(lng, lat2);
      }
    }
    return new Float32Array(verts);
  }

  const FLOATS_PER_VERTEX = 4;          // mercX, mercY, lng, lat
  const VERTEX_STRIDE = FLOATS_PER_VERTEX * 4;

  const dayNightLayer = {
    id: "h2grid-daynight",
    type: "custom",
    renderingMode: "2d",
    shaderMap: new Map(),
    visible: true,
    gl: null,
    vbo: null,
    vertexCount: 0,

    getShader(gl, shaderDescription) {
      if (this.shaderMap.has(shaderDescription.variantName)) return this.shaderMap.get(shaderDescription.variantName);

      const vertexSource = `#version 300 es
${shaderDescription.vertexShaderPrelude}
${shaderDescription.define}

in vec2 a_pos;
in vec2 a_lngLat;

out vec2 v_lngLat;

void main() {
  gl_Position = projectTileFor3D(a_pos, 0.0);
  v_lngLat = a_lngLat;
}`;

      const fragmentSource = `#version 300 es
precision highp float;

in vec2 v_lngLat;

uniform vec2 u_subsolar;     // [lng, lat] degrees
uniform float u_nightStart;
uniform float u_nightFull;
uniform float u_dayStart;
uniform float u_dayFull;
uniform float u_nightAlpha;
uniform float u_dayAlpha;

out vec4 fragColor;

const float RAD = 0.017453292519943295;

void main() {
  float lng = v_lngLat.x * RAD;
  float lat = v_lngLat.y * RAD;
  float sLng = u_subsolar.x * RAD;
  float sLat = u_subsolar.y * RAD;

  // Cosine of the solar zenith angle at this point: the standard spherical
  // law of cosines between the surface normal and the subsolar direction.
  // > 0 means the sun is above the horizon here.
  float cosZ = sin(lat) * sin(sLat) + cos(lat) * cos(sLat) * cos(lng - sLng);

  float night = smoothstep(u_nightStart, u_nightFull, cosZ);
  float day   = smoothstep(u_dayStart, u_dayFull, cosZ);

  // Night: deep blue-black, deliberately not pure black so the basemap keeps
  // some form and the city lights below still read through it.
  vec3 nightCol = vec3(0.004, 0.013, 0.036);
  // Day: a cool bright haze. This is what dims the NASA city-lights raster
  // back down on the lit hemisphere — the raster has no spatial opacity
  // control of its own, so it has to be covered rather than masked.
  vec3 dayCol = vec3(0.40, 0.56, 0.76);

  float aNight = night * u_nightAlpha;
  float aDay = day * u_dayAlpha;
  float a = aNight + aDay;
  if (a < 0.001) discard;

  vec3 c = (nightCol * aNight + dayCol * aDay) / a;
  fragColor = vec4(c, a);
}`;

      const vs = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vs, vertexSource);
      gl.compileShader(vs);
      if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) console.error("h2grid-daynight vertex shader:", gl.getShaderInfoLog(vs));

      const fs = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fs, fragmentSource);
      gl.compileShader(fs);
      if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) console.error("h2grid-daynight fragment shader:", gl.getShaderInfoLog(fs));

      const program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) console.error("h2grid-daynight program link:", gl.getProgramInfoLog(program));

      this.shaderMap.set(shaderDescription.variantName, program);
      return program;
    },

    onAdd(_map, gl) {
      this.gl = gl;
      const data = buildMesh();
      this.vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
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

      const [sLng, sLat] = currentSubsolar();
      gl.uniform2f(gl.getUniformLocation(program, "u_subsolar"), sLng, sLat);
      gl.uniform1f(gl.getUniformLocation(program, "u_nightStart"), NIGHT_START);
      gl.uniform1f(gl.getUniformLocation(program, "u_nightFull"), NIGHT_FULL);
      gl.uniform1f(gl.getUniformLocation(program, "u_dayStart"), DAY_START);
      gl.uniform1f(gl.getUniformLocation(program, "u_dayFull"), DAY_FULL);
      gl.uniform1f(gl.getUniformLocation(program, "u_nightAlpha"), NIGHT_ALPHA);
      gl.uniform1f(gl.getUniformLocation(program, "u_dayAlpha"), DAY_ALPHA);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // normal compositing, not additive

      const aPos = gl.getAttribLocation(program, "a_pos");
      const aLngLat = gl.getAttribLocation(program, "a_lngLat");
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, VERTEX_STRIDE, 0);
      gl.enableVertexAttribArray(aLngLat);
      gl.vertexAttribPointer(aLngLat, 2, gl.FLOAT, false, VERTEX_STRIDE, 2 * 4);

      gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    }
  };

  // Recomputed at most once a minute — the subsolar point moves 0.25°/minute,
  // far below what is visible, and this runs inside the render loop.
  let cached = null, cachedAt = 0;
  function currentSubsolar() {
    const now = Date.now();
    if (!cached || now - cachedAt > 60000) {
      cached = (window.H2GSun && window.H2GSun.subsolarPoint)
        ? window.H2GSun.subsolarPoint(new Date())
        : [0, 0];
      cachedAt = now;
    }
    return cached;
  }

  // Inserted beneath the coastline so it shades the basemap and the city-light
  // raster but never the data layers. Same defensive registration as
  // 20-spikes.js: map.on("load") alone is a one-shot that gets missed when the
  // style finishes before this module parses.
  function addDayNightLayer() {
    if (map.getLayer(dayNightLayer.id)) return;
    map.addLayer(dayNightLayer, map.getLayer("coast-glow") ? "coast-glow" : undefined);
  }
  if (map.isStyleLoaded()) addDayNightLayer();
  map.on("load", addDayNightLayer);
  map.on("styledata", addDayNightLayer);

  window.H2GDayNight = {
    setVisible(on) {
      dayNightLayer.visible = !!on;
      map.triggerRepaint();
    },
    subsolar: currentSubsolar
  };
})();
