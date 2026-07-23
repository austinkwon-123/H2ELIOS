/* ==========================================================================
   H2Grid · Macro Flow (cinematic Deck.gl view)
   Own standalone route ("macro-flow" - see 09-router.js), reachable via its
   own sub-nav tab. Deliberately NOT merged into the existing Demand &
   Transport dashboard (13-demand-transport.js), which stays untouched -
   this is an additional, separate, executive-presentation-style view.

   CRITICAL CONSTRAINT ACKNOWLEDGED: every other view in this app is pure
   MapLibre GL + vanilla WebGL (see 19-command-arcs.js's raw
   CustomLayerInterface). Deck.gl is used ONLY here, and only because this
   view was explicitly authorized to use it for exactly the kind of complex
   volumetric 3D arc/particle rendering vanilla MapLibre struggles with.
   Loaded lazily (dynamic <script> injection) on first visit to this route,
   not in the global <head>, so every other page's load time is unaffected
   by a dependency only this one view needs.
   ======================================================================= */
(function () {
  const SKY_ELEVATION = 500000; // meters - per spec, sky hubs float 500km up
  const CYAN = [63, 214, 232];
  const PINK = [255, 42, 85];

  // gl.SRC_ALPHA = 770, gl.ONE = 1 - standard WebGL blend-factor enum values.
  // Passed as raw numbers (not imported from @luma.gl/constants) so this
  // view doesn't need a second CDN dependency just for two integer constants.
  const ADDITIVE_BLEND_PARAMS = { blend: true, blendFunc: [770, 1], depthTest: false };

  const PRODUCTION_REGIONS = [
    { name: "Pilbara, Australia", center: [118.6, -20.7] },
    { name: "Texas Gulf Coast", center: [-95.3, 29.7] },
    { name: "Arabian Gulf", center: [50.5, 25.3] }
  ];
  const DEMAND_REGIONS = [
    { name: "Rotterdam, Europe", center: [6.5, 51.9] },
    { name: "Japan", center: [138.2, 36.2] },
    { name: "South Korea", center: [127.8, 35.9] }
  ];

  function jitter(center, spreadDeg) {
    return [center[0] + (Math.random() - 0.5) * spreadDeg, center[1] + (Math.random() - 0.5) * spreadDeg];
  }

  // Builds the "funnel" architecture: ground nodes clustered around 3
  // production + 3 demand regions, one elevated sky hub per region, a
  // volumetric cloud of extra points around each hub, and the connecting
  // arcs (ground->sky for production, sky->sky mesh, sky->ground for demand).
  function generateFlowData() {
    const regions = [
      ...PRODUCTION_REGIONS.map((r) => ({ ...r, kind: "production" })),
      ...DEMAND_REGIONS.map((r) => ({ ...r, kind: "demand" }))
    ];

    const groundNodes = [];
    const perRegion = Math.floor(200 / regions.length); // 200 total, per spec, split across all 6 regions
    regions.forEach((r, i) => {
      for (let j = 0; j < perRegion; j++) {
        groundNodes.push({ position: jitter(r.center, 6), kind: r.kind, regionIndex: i });
      }
    });

    const skyHubs = regions.map((r, i) => ({
      position: [r.center[0], r.center[1], SKY_ELEVATION],
      kind: r.kind,
      regionIndex: i,
      name: r.name
    }));

    // Sky cloud: a jittered scatter of extra points around each hub so the
    // "floating market" reads as a volumetric cloud, not a single dot.
    const cloudPoints = [];
    skyHubs.forEach((hub) => {
      for (let k = 0; k < 14; k++) {
        cloudPoints.push({
          position: [
            hub.position[0] + (Math.random() - 0.5) * 8,
            hub.position[1] + (Math.random() - 0.5) * 8,
            SKY_ELEVATION + (Math.random() - 0.5) * 120000
          ],
          kind: hub.kind
        });
      }
    });

    const arcs = [];
    groundNodes.filter((n) => n.kind === "production").forEach((n) => {
      arcs.push({ source: n.position, target: skyHubs[n.regionIndex].position, kind: "up" });
    });
    skyHubs.filter((h) => h.kind === "production").forEach((ph) => {
      skyHubs.filter((h) => h.kind === "demand").forEach((dh) => {
        arcs.push({ source: ph.position, target: dh.position, kind: "cross" });
      });
    });
    groundNodes.filter((n) => n.kind === "demand").forEach((n) => {
      arcs.push({ source: skyHubs[n.regionIndex].position, target: n.position, kind: "down" });
    });

    return { groundNodes, skyHubs, cloudPoints, arcs };
  }

  function buildLayers(data) {
    const { ArcLayer, ScatterplotLayer } = window.deck;

    const arcLayer = new ArcLayer({
      id: "macro-flow-arcs",
      data: data.arcs,
      getSourcePosition: (d) => d.source,
      getTargetPosition: (d) => d.target,
      // "up" (production->sky) is pure cyan both ends; "down" (sky->demand)
      // is pure pink both ends; "cross" (sky->sky) gradients cyan->pink so
      // the mesh itself visually reads as "supply flowing toward demand".
      getSourceColor: (d) => (d.kind === "down" ? PINK : CYAN),
      getTargetColor: (d) => (d.kind === "up" ? CYAN : PINK),
      getWidth: 2,
      greatCircle: true, // matters most for the long intercontinental sky->sky arcs
      parameters: ADDITIVE_BLEND_PARAMS // overlapping arcs burn white-hot instead of just alpha-compositing
    });

    const cloudLayer = new ScatterplotLayer({
      id: "macro-flow-cloud",
      data: data.cloudPoints,
      getPosition: (d) => d.position,
      getFillColor: [235, 250, 255, 220],
      radiusUnits: "pixels",
      getRadius: 2,
      radiusMinPixels: 1.5,
      radiusMaxPixels: 4,
      parameters: ADDITIVE_BLEND_PARAMS
    });

    const hubLayer = new ScatterplotLayer({
      id: "macro-flow-hubs",
      data: data.skyHubs,
      getPosition: (d) => d.position,
      getFillColor: [...CYAN, 255],
      radiusUnits: "pixels",
      getRadius: 5,
      parameters: ADDITIVE_BLEND_PARAMS
    });

    return [cloudLayer, arcLayer, hubLayer];
  }

  // deck.gl isn't loaded in <head> - only this one view needs it, so it's
  // fetched on first visit via a dynamically injected <script>, not a
  // static include every page load would pay for.
  function loadDeckGL() {
    if (window.deck && window.deck.MapboxOverlay) return Promise.resolve();
    if (window.__h2gridDeckGLPromise) return window.__h2gridDeckGLPromise;
    window.__h2gridDeckGLPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://unpkg.com/deck.gl@^9.0.0/dist.min.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("deck.gl script failed to load"));
      document.head.appendChild(script);
    });
    return window.__h2gridDeckGLPromise;
  }

  function buildUIOverlay(container) {
    const header = document.createElement("div");
    header.className = "macro-flow-header";
    header.innerHTML = `<h1>Global Supply &amp; Demand Matrix</h1><p>Macro Hydrogen Flow — Production &rarr; Global Market &rarr; Demand</p>`;
    container.appendChild(header);

    const timeline = document.createElement("div");
    timeline.className = "macro-flow-timeline";
    timeline.innerHTML = `
      <span class="mf-year" id="mf-year-readout">2025</span>
      <input type="range" id="mf-year-slider" min="2025" max="2035" step="1" value="2025" />
      <div class="mf-range-labels"><span>2025</span><span>2035</span></div>
    `;
    container.appendChild(timeline);

    timeline.querySelector("#mf-year-slider").addEventListener("input", (e) => {
      timeline.querySelector("#mf-year-readout").textContent = e.target.value;
    });
  }

  let flowMap = null;
  let rotating = false;

  function startFlowRotation() {
    if (rotating || !flowMap) return;
    rotating = true;
    function frame() {
      if (!rotating) return;
      flowMap.setBearing((flowMap.getBearing() + 0.05) % 360);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  function stopFlowRotation() { rotating = false; }

  function initMacroFlowPage() {
    const page = document.getElementById("page-macro-flow");
    if (!page) return;

    const container = document.createElement("div");
    container.id = "macro-flow-container";
    page.appendChild(container);

    const mapEl = document.createElement("div");
    mapEl.id = "macro-flow-map";
    mapEl.style.position = "absolute";
    mapEl.style.inset = "0";
    container.appendChild(mapEl);

    const loading = document.createElement("div");
    loading.id = "macro-flow-loading";
    loading.textContent = "Initializing WebGL data layer…";
    container.appendChild(loading);

    loadDeckGL()
      .then(() => {
        const data = generateFlowData();

        // Deep-cloned rather than passed the shared H2GRID_BASE_STYLE object
        // directly - two live MapLibre instances shouldn't hold references
        // into the same mutable style object.
        flowMap = new maplibregl.Map({
          container: mapEl,
          style: JSON.parse(JSON.stringify(H2GRID_BASE_STYLE)),
          center: [40, 15],
          zoom: 1.6,
          pitch: 50,
          bearing: 0,
          attributionControl: false
        });

        flowMap.on("load", () => {
          const deckOverlay = new deck.MapboxOverlay({ layers: buildLayers(data) });
          flowMap.addControl(deckOverlay);
          loading.remove();
          buildUIOverlay(container);
          startFlowRotation();
        });
      })
      .catch((err) => {
        console.error("Macro Flow: deck.gl failed to load", err);
        loading.textContent = "Failed to load WebGL data layer — check your connection.";
      });
  }

  window.initMacroFlowPage = initMacroFlowPage;

  // Wrap-and-call-through (same convention as applyFilters/selectFacility
  // elsewhere): start the rotation loop whenever this route becomes active,
  // stop it on every other route so it doesn't spin forever off-screen.
  const _navigateTo = navigateTo;
  navigateTo = function (route) {
    _navigateTo(route);
    if (route === "macro-flow") {
      startFlowRotation();
      if (flowMap) requestAnimationFrame(() => flowMap.resize());
    } else {
      stopFlowRotation();
    }
  };
})();
