/* ========================================================================
   H2ELIOS · True 3D pipeline ribbons
   Raw WebGL2 through MapLibre's CustomLayerInterface. Native line layers
   stay draped on the globe; this companion layer gives the same reported
   D.pipelines routes a shallow raised body without inventing any new route.

   This deliberately does NOT restore the former command-arc module. That
   file mixed physical pipelines with synthetic supply-chain corridors and
   kept MapLibre repainting forever for a traveling pulse. Here the Pipelines
   dock control owns one dataset and one rendering layer. Motion is static by
   default and can only repaint continuously through ambientMotionAllowed(),
   the same policy gate used by the rest of the globe.
   ====================================================================== */
(function () {
  const PIPE_STEP_KM = 25;
  const FLOATS_PER_VERTEX = 13;
  const VERTEX_STRIDE = FLOATS_PER_VERTEX * 4;
  const STATUS_GAIN = { operating: 1, construction: 0.98, planned: 0.95, atrisk: 0.9, other: 0.9 };

  function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
  function smoothstep(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function toRad(degrees) { return (degrees * Math.PI) / 180; }
  function toDeg(radians) { return (radians * 180) / Math.PI; }
  function hexToRgb01(hex) {
    const n = parseInt(String(hex).slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  function pipelinesDockActive() {
    const button = document.querySelector('.dock-btn[data-layer="pipelines"]');
    return button ? button.classList.contains("active") : false;
  }
  function motionAllowed() {
    return typeof ambientMotionAllowed === "function" && ambientMotionAllowed();
  }
  function widthScaleFor(zoom) {
    // Mercator world pixels double each zoom. Counter most of that growth once
    // the user leaves the globe overview so a readable 3px ribbon there does
    // not become a 40px band over a city at z7.
    return Math.min(1, Math.max(0.035, Math.pow(2, -(zoom - 3) * 1.15)));
  }

  function slerp(a, b, fraction) {
    const lat1 = toRad(a[1]), lng1 = toRad(a[0]);
    const lat2 = toRad(b[1]), lng2 = toRad(b[0]);
    const cosDistance = clamp(
      Math.sin(lat1) * Math.sin(lat2) + Math.cos(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1),
      -1,
      1
    );
    const distance = Math.acos(cosDistance);
    if (distance < 1e-9) return [a[0], a[1]];
    const A = Math.sin((1 - fraction) * distance) / Math.sin(distance);
    const B = Math.sin(fraction * distance) / Math.sin(distance);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    return [toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.hypot(x, y)))];
  }

  function pathLengthKm(lngLats) {
    let total = 0;
    for (let i = 1; i < lngLats.length; i++) total += kmDist(lngLats[i - 1], lngLats[i]);
    return total;
  }

  function progressAlong(lngLats) {
    const cumulative = [0];
    for (let i = 1; i < lngLats.length; i++) {
      cumulative.push(cumulative[i - 1] + kmDist(lngLats[i - 1], lngLats[i]));
    }
    const total = cumulative[cumulative.length - 1] || 1;
    return cumulative.map((distance) => distance / total);
  }

  // Long reported segments must follow the globe instead of cutting through
  // it. Subdivision adds samples only; it never moves the source vertices, so
  // the raised conduit continues to trace the reported right-of-way exactly.
  function densify(coords) {
    const out = [coords[0]];
    for (let i = 1; i < coords.length; i++) {
      const a = coords[i - 1], b = coords[i];
      const steps = Math.max(2, Math.ceil(kmDist(a, b) / PIPE_STEP_KM));
      for (let step = 1; step <= steps; step++) out.push(slerp(a, b, step / steps));
    }
    return out;
  }

  function pipelineRoute(feature) {
    const properties = feature.properties;
    const lngLats = densify(feature.geometry.coordinates);
    const lengthKm = pathLengthKm(lngLats);
    // A pipeline must still read as infrastructure attached to the ground.
    // The previous 1,800km floor made a 32km route into a near-vertical wall:
    // it vanished at globe scale, then shot off-screen when the user opened
    // the project. Tens of kilometres of analytical lift are enough to expose
    // the top and side faces without turning a local right-of-way into a sky
    // arc. The profile stays flat so it cannot be confused with a corridor.
    const lift = clamp(lengthKm * 300, 45000, 220000);
    const progress = progressAlong(lngLats);
    const gain = STATUS_GAIN[properties.statusClass] || STATUS_GAIN.other;
    const rgb = hexToRgb01(COLORS[properties.color] || COLORS.gray_blue);
    return {
      lngLats,
      progress,
      elevations: progress.map((fraction) => lift * smoothstep(0, 0.10, fraction) * smoothstep(0, 0.10, 1 - fraction)),
      // Width is set in world space here, then counter-scaled in the shader as
      // zoom rises. This resolves to roughly a 2px ribbon on the globe and a
      // 4-7px selectable conduit in a regional project view.
      halfWidth: clamp(lengthKm * 6e-7, 0.00045, 0.00095),
      wave: clamp(lengthKm / 260, 2, 14),
      colorRGB: [rgb[0] * gain, rgb[1] * gain, rgb[2] * gain],
      sourceProps: properties
    };
  }

  // Every sample contributes the left and right side of a triangle strip:
    // [centerX, centerY, normalX, normalY, progress, side, r, g, b,
    //  elevationMetres, waves, halfWidth, topFace]. Keeping center and normal separate
  // lets the shader hold screen width steady as the camera zooms.
  function buildRibbon(route) {
    const mercator = route.lngLats.map((point) => maplibregl.MercatorCoordinate.fromLngLat({ lng: point[0], lat: point[1] }));
    const last = mercator.length - 1;
    const normals = [];
    for (let i = 0; i <= last; i++) {
      const previous = mercator[Math.max(0, i - 1)], next = mercator[Math.min(last, i + 1)];
      let dx = next.x - previous.x, dy = next.y - previous.y;
      const length = Math.hypot(dx, dy) || 1e-9;
      dx /= length;
      dy /= length;
      normals.push([-dy, dx]);
    }

    const top = [];
    const walls = [];
    function pushVertex(target, index, side, elevation, topFace, normalGain = 1) {
      const point = mercator[index], normal = normals[index];
      target.push(point.x, point.y, normal[0] * normalGain, normal[1] * normalGain,
        route.progress[index], side, route.colorRGB[0], route.colorRGB[1], route.colorRGB[2],
        elevation, route.wave, route.halfWidth, topFace);
    }

    for (let i = 0; i <= last; i++) {
      pushVertex(top, i, 1, route.elevations[i], 1);
      pushVertex(top, i, -1, route.elevations[i], 1);
    }

    // The top strip alone reads as a slightly displaced 2D line when viewed
    // from orbit. Two shallow side faces give the conduit an actual raised body.
    // a_side also drives the top-strip edge fade, so the walls encode a 0.55
    // side value and compensate in the normal: position stays at the true
    // outer edge while the fragment retains enough opacity to show volume.
    const wallSide = 0.55;
    const wallNormalGain = 1 / wallSide;
    for (let i = 0; i < last; i++) {
      for (const sign of [-1, 1]) {
        const side = sign * wallSide;
        const baseA = Math.min(2500, route.elevations[i]);
        const baseB = Math.min(2500, route.elevations[i + 1]);
        pushVertex(walls, i, side, baseA, 0, wallNormalGain);
        pushVertex(walls, i, side, route.elevations[i], 0, wallNormalGain);
        pushVertex(walls, i + 1, side, route.elevations[i + 1], 0, wallNormalGain);
        pushVertex(walls, i, side, baseA, 0, wallNormalGain);
        pushVertex(walls, i + 1, side, route.elevations[i + 1], 0, wallNormalGain);
        pushVertex(walls, i + 1, side, baseB, 0, wallNormalGain);
      }
    }
    return { top: new Float32Array(top), walls: new Float32Array(walls) };
  }

  const PIPELINES = D.pipelines.features
    .filter((feature) => feature.geometry && feature.geometry.type === "LineString" &&
      feature.geometry.coordinates.length > 1 && feature.properties.h2infraRibbon3d !== false)
    .map(pipelineRoute);

  const pipelineLayer = {
    id: "h2grid-3d-pipelines",
    type: "custom",
    renderingMode: "3d",
    shaderMap: new Map(),
    buffers: [],
    visible: pipelinesDockActive(),

    getShader(gl, shaderDescription) {
      if (this.shaderMap.has(shaderDescription.variantName)) return this.shaderMap.get(shaderDescription.variantName);

      // projectTileFor3D() is MapLibre v5's projection-aware path. It keeps
      // metre elevation correct under globe, mercator and their zoom blend;
      // a hand-built matrix would be correct for only one of those modes.
      const vertexSource = `#version 300 es
${shaderDescription.vertexShaderPrelude}
${shaderDescription.define}

in vec2 a_center;
in vec2 a_normal;
in float a_progress;
in float a_side;
in vec3 a_color;
in float a_elevation;
in float a_wave;
in float a_halfWidth;
in float a_topFace;

uniform float u_widthScale;

out float v_progress;
out float v_side;
out vec3 v_color;
out float v_wave;
out float v_topFace;

void main() {
  vec2 pos = a_center + a_normal * a_side * a_halfWidth * u_widthScale;
  gl_Position = projectTileFor3D(pos, a_elevation);
  v_progress = a_progress;
  v_side = a_side;
  v_color = a_color;
  v_wave = a_wave;
  v_topFace = a_topFace;
}`;

      const fragmentSource = `#version 300 es
precision highp float;

in float v_progress;
in float v_side;
in vec3 v_color;
in float v_wave;
in float v_topFace;

uniform float u_time;
uniform float u_motion;
uniform float u_lightMode;

out vec4 fragColor;

void main() {
  float cross = 1.0 - smoothstep(0.0, 1.0, abs(v_side));
  float core = pow(cross, 3.0);
  float endFade = smoothstep(0.0, 0.06, v_progress) * smoothstep(0.0, 0.06, 1.0 - v_progress);
  float stillHighlight = 0.76 + 0.08 * sin(v_progress * v_wave);
  float travelingHighlight = 0.5 + 0.5 * sin(v_progress * v_wave - u_time * 2.2);
  float highlight = mix(stillHighlight, travelingHighlight, u_motion);
  float topAlpha = (cross * 0.42 + core * 0.58) * endFade * (0.88 + 0.12 * highlight);
  float wallAlpha = (0.20 + cross * 0.28) * endFade;
  // Keep the route's hydrogen taxonomy colour authoritative. A restrained
  // white-metal highlight separates the raised face from the matching draped
  // line without introducing an unrelated orange infrastructure category.
  vec3 topColor = mix(v_color, vec3(0.92, 0.98, 1.0), 0.24) * (1.04 + 0.52 * highlight);
  vec3 wallColor = v_color * (0.68 + 0.16 * highlight);
  vec3 color = mix(wallColor, topColor, v_topFace);
  float alpha = mix(wallAlpha, topAlpha, v_topFace);
  color = mix(color, color * 0.38, u_lightMode);
  alpha *= mix(1.0, 0.76, u_lightMode);
  fragColor = vec4(color, alpha);
}`;

      const vertexShader = gl.createShader(gl.VERTEX_SHADER);
      gl.shaderSource(vertexShader, vertexSource);
      gl.compileShader(vertexShader);
      if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
        console.error("h2grid-3d-pipelines vertex shader:", gl.getShaderInfoLog(vertexShader));
      }

      const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
      gl.shaderSource(fragmentShader, fragmentSource);
      gl.compileShader(fragmentShader);
      if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
        console.error("h2grid-3d-pipelines fragment shader:", gl.getShaderInfoLog(fragmentShader));
      }

      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("h2grid-3d-pipelines program link:", gl.getProgramInfoLog(program));
      }
      this.shaderMap.set(shaderDescription.variantName, program);
      return program;
    },

    onAdd(_map, gl) {
      this.buffers = PIPELINES.map((route) => {
        const data = buildRibbon(route);
        const topVbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, topVbo);
        gl.bufferData(gl.ARRAY_BUFFER, data.top, gl.STATIC_DRAW);
        const wallVbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, wallVbo);
        gl.bufferData(gl.ARRAY_BUFFER, data.walls, gl.STATIC_DRAW);
        return {
          topVbo,
          topCount: data.top.length / FLOATS_PER_VERTEX,
          wallVbo,
          wallCount: data.walls.length / FLOATS_PER_VERTEX
        };
      });
    },

    render(gl, args) {
      if (!this.visible || !this.buffers.length) return;
      const program = this.getShader(gl, args.shaderData);
      gl.useProgram(program);

      const projection = args.defaultProjectionData;
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_projection_fallback_matrix"), false, projection.fallbackMatrix);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "u_projection_matrix"), false, projection.mainMatrix);
      gl.uniform4f(gl.getUniformLocation(program, "u_projection_tile_mercator_coords"),
        projection.tileMercatorCoords[0], projection.tileMercatorCoords[1], projection.tileMercatorCoords[2], projection.tileMercatorCoords[3]);
      gl.uniform4f(gl.getUniformLocation(program, "u_projection_clipping_plane"),
        projection.clippingPlane[0], projection.clippingPlane[1], projection.clippingPlane[2], projection.clippingPlane[3]);
      gl.uniform1f(gl.getUniformLocation(program, "u_projection_transition"), projection.projectionTransition);

      const animate = motionAllowed();
      const lightTheme = h2eliosLightMode;
      gl.uniform1f(gl.getUniformLocation(program, "u_widthScale"), widthScaleFor(map.getZoom()));
      gl.uniform1f(gl.getUniformLocation(program, "u_time"), animate ? performance.now() / 1000 : 0);
      gl.uniform1f(gl.getUniformLocation(program, "u_motion"), animate ? 1 : 0);
      gl.uniform1f(gl.getUniformLocation(program, "u_lightMode"), lightTheme ? 1 : 0);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, lightTheme ? gl.ONE_MINUS_SRC_ALPHA : gl.ONE);
      const cullWasEnabled = gl.isEnabled(gl.CULL_FACE);
      const depthWasEnabled = gl.isEnabled(gl.DEPTH_TEST);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);

      const aCenter = gl.getAttribLocation(program, "a_center");
      const aNormal = gl.getAttribLocation(program, "a_normal");
      const aProgress = gl.getAttribLocation(program, "a_progress");
      const aSide = gl.getAttribLocation(program, "a_side");
      const aColor = gl.getAttribLocation(program, "a_color");
      const aElevation = gl.getAttribLocation(program, "a_elevation");
      const aWave = gl.getAttribLocation(program, "a_wave");
      const aHalfWidth = gl.getAttribLocation(program, "a_halfWidth");
      const aTopFace = gl.getAttribLocation(program, "a_topFace");

      function bindAttributes(vbo) {
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.enableVertexAttribArray(aCenter);
        gl.vertexAttribPointer(aCenter, 2, gl.FLOAT, false, VERTEX_STRIDE, 0);
        gl.enableVertexAttribArray(aNormal);
        gl.vertexAttribPointer(aNormal, 2, gl.FLOAT, false, VERTEX_STRIDE, 2 * 4);
        gl.enableVertexAttribArray(aProgress);
        gl.vertexAttribPointer(aProgress, 1, gl.FLOAT, false, VERTEX_STRIDE, 4 * 4);
        gl.enableVertexAttribArray(aSide);
        gl.vertexAttribPointer(aSide, 1, gl.FLOAT, false, VERTEX_STRIDE, 5 * 4);
        gl.enableVertexAttribArray(aColor);
        gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, VERTEX_STRIDE, 6 * 4);
        gl.enableVertexAttribArray(aElevation);
        gl.vertexAttribPointer(aElevation, 1, gl.FLOAT, false, VERTEX_STRIDE, 9 * 4);
        gl.enableVertexAttribArray(aWave);
        gl.vertexAttribPointer(aWave, 1, gl.FLOAT, false, VERTEX_STRIDE, 10 * 4);
        gl.enableVertexAttribArray(aHalfWidth);
        gl.vertexAttribPointer(aHalfWidth, 1, gl.FLOAT, false, VERTEX_STRIDE, 11 * 4);
        gl.enableVertexAttribArray(aTopFace);
        gl.vertexAttribPointer(aTopFace, 1, gl.FLOAT, false, VERTEX_STRIDE, 12 * 4);
      }

      this.buffers.forEach((buffer) => {
        // Opaque-ish side walls first, then the glowing top so its centerline
        // remains crisp instead of being dulled by the wall blend.
        bindAttributes(buffer.wallVbo);
        gl.drawArrays(gl.TRIANGLES, 0, buffer.wallCount);
        bindAttributes(buffer.topVbo);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, buffer.topCount);
      });
      if (cullWasEnabled) gl.enable(gl.CULL_FACE);
      if (!depthWasEnabled) gl.disable(gl.DEPTH_TEST);

      // No unconditional repaint loop. The present policy resolves false, so
      // the conduits remain static after MapLibre finishes the current frame.
      if (animate) map.triggerRepaint();
    }
  };

  function raiseToTop() {
    if (!map.getLayer(pipelineLayer.id)) return;
    map.moveLayer(pipelineLayer.id);
  }

  // moveLayer itself emits styledata. Layer count is the guard that lets the
  // conduit rise above later-added draped layers without creating a styledata
  // recursion that prevents the map's load event from ever settling.
  let lastLayerCount = -1;
  function placeIfLayersChanged() {
    const layers = map.getStyle()?.layers || [];
    if (layers.length === lastLayerCount) return;
    lastLayerCount = layers.length;
    raiseToTop();
  }
  function addPipelineLayer() {
    if (!map.getLayer(pipelineLayer.id)) map.addLayer(pipelineLayer);
  }
  if (map.isStyleLoaded()) addPipelineLayer();
  map.on("load", addPipelineLayer);
  map.on("styledata", () => { addPipelineLayer(); placeIfLayersChanged(); });

  // The visible ribbon sits above its draped source line, outside MapLibre's
  // normal layer hit-testing. A modest screen-space fallback keeps selecting
  // the same real pipeline record; it never runs when a native clickable layer
  // is already under the pointer.
  const HIT_TOLERANCE_PX = 16;
  const CLICKABLE_LAYERS = ["upstream", "production", "manufacturing", "storage", "pipelines", "endUse", "fuelingStations", "hubs"];
  function distanceToSegment(point, a, b) {
    const abx = b.x - a.x, aby = b.y - a.y;
    const lengthSquared = abx * abx + aby * aby;
    const amount = clamp(lengthSquared ? ((point.x - a.x) * abx + (point.y - a.y) * aby) / lengthSquared : 0, 0, 1);
    return Math.hypot(point.x - (a.x + amount * abx), point.y - (a.y + amount * aby));
  }
  function nearestPipelineAt(point) {
    if (!pipelineLayer.visible) return null;
    let best = null, bestDistance = HIT_TOLERANCE_PX;
    PIPELINES.forEach((route) => {
      const points = route.lngLats.map((lngLat) => map.project(lngLat));
      for (let i = 1; i < points.length; i++) {
        const distance = distanceToSegment(point, points[i - 1], points[i]);
        if (distance < bestDistance) { bestDistance = distance; best = route; }
      }
    });
    return best;
  }
  map.on("click", (event) => {
    const nativeLayers = CLICKABLE_LAYERS.filter((id) => map.getLayer(id));
    if (map.queryRenderedFeatures(event.point, { layers: nativeLayers }).length) return;
    const route = nearestPipelineAt(event.point);
    if (route && typeof selectFacility === "function") {
      selectFacility(route.sourceProps, [event.lngLat.lng, event.lngLat.lat]);
    }
  });

  window.H2GPipelines = {
    setVisible(on) {
      pipelineLayer.visible = !!on;
      if (pipelineLayer.visible) raiseToTop();
      map.triggerRepaint();
    },
    debug() {
      return {
        pipelines: PIPELINES.length,
        buffers: pipelineLayer.buffers.length,
        visible: pipelineLayer.visible,
        ambientMotion: motionAllowed(),
        widthScale: widthScaleFor(map.getZoom()),
        minHalfWidth: Math.min.apply(null, PIPELINES.map((route) => route.halfWidth)),
        minLiftM: Math.min.apply(null, PIPELINES.map((route) => Math.max.apply(null, route.elevations))),
        maxLiftM: Math.max.apply(null, PIPELINES.map((route) => Math.max.apply(null, route.elevations))),
        pipelineSamples: PIPELINES.map((route) => ({
          points: route.lngLats.length,
          lengthKm: Math.round(pathLengthKm(route.lngLats)),
          maxLiftM: Math.round(Math.max.apply(null, route.elevations))
        }))
      };
    }
  };
})();
