/* ==========================================================================
   H2ELIOS · Cinematic walkthrough
   A self-playing film, not a tour. It supersedes the step-card walkthrough in
   22-demo.js: no Next button, no reading, no branching. Press play and watch.

   Three rules the old walkthrough broke and this one keeps:

     · Every beat drives the real controls — the same globals the dock, the
       filter flyouts and the inspector write to. Nothing is faked, so the film
       cannot drift out of sync with the product the way a recorded video does.
     · Beats hold for a declared duration and never wait on a human. The total
       is asserted under two minutes by the test suite.
     · Exit restores everything it touched: fullscreen, focus mode, filters,
       layer toggles, panels, camera. A film that leaves the app in a strange
       state is worse than no film.

   Load after 19-command-arcs.js (corridors), 19-pipeline-ribbons.js and
   20-spikes.js — the beats reference all three.
   ======================================================================= */
(function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const el = (id) => document.getElementById(id);

  // ---- Real controls -------------------------------------------------------
  function dock(layer, on) {
    const btn = document.querySelector('.dock-btn[data-layer="' + layer + '"]');
    if (!btn) return;
    if (btn.classList.contains("active") !== !!on) btn.click();
  }

  function set3D(on) {
    if (!!window.is3DActive === !!on) return;
    el("dock-3d-btn")?.click();
  }

  function setFilters(next) {
    const options = next || {};
    statusFilter = options.status || "all";
    colorFilter = options.color || null;
    regionFilter = options.region || "all";
    if (typeof applyFilters === "function") applyFilters();
    if (window.is3DActive && typeof update3DTowers === "function") update3DTowers();
  }

  function closePanels() {
    if (typeof closeAnalyticsPanel === "function") closeAnalyticsPanel();
    if (typeof closeMarketsPanel === "function") closeMarketsPanel();
    if (typeof closeDetailPanel === "function" && !el("detail-card")?.hidden) closeDetailPanel(false);
    document.querySelectorAll("#snapshot-row .detail-snapshot, #minimized-tray .mini-card").forEach((n) => n.remove());
    if (typeof openSnapshots !== "undefined") openSnapshots.length = 0;
    window.H2Store?.dispatch({ type: "COMPARISON_CLEAR" });
  }

  // Beats name real records. Looking them up by name rather than by index means
  // a data refresh that reorders the collections cannot silently repoint a beat
  // at some other project, and a record that disappears degrades to a skipped
  // sub-step instead of throwing mid-film.
  function projectNamed(name) {
    const collections = [D.production, D.storagePoints, D.manufacturing, D.upstream, D.endUse];
    for (const collection of collections) {
      const hit = ((collection && collection.features) || []).find((f) => f.properties && f.properties.name === name);
      if (hit && hit.geometry && hit.geometry.type === "Point") return hit;
    }
    return null;
  }

  function openProject(name) {
    const feature = projectNamed(name);
    if (!feature) return false;
    if (typeof selectFacility === "function") selectFacility(feature.properties, feature.geometry.coordinates);
    return true;
  }

  // MapLibre implements setPadding as a jumpTo, so a padding sync that lands
  // after a beat has started its flight silently cancels the animation and the
  // camera just sits there. Toggling dock layers can trigger one — closing a
  // panel changes which right-hand inspector is open — so a beat that changes
  // controls AND moves the camera settles the shell first, spending the jump
  // before the flight begins rather than during it.
  async function settleShell() {
    if (typeof syncSpatialMapPadding === "function") syncSpatialMapPadding();
    // Two frames is the reliable signal that layout has flushed, but
    // requestAnimationFrame never fires while the tab is hidden. Racing it
    // against a timer means a viewer who switches away mid-film comes back to a
    // film that kept going, rather than one frozen on whichever beat was
    // running when they left.
    await new Promise((resolve) => {
      let settled = false;
      const finish = () => { if (!settled) { settled = true; resolve(); } };
      requestAnimationFrame(() => requestAnimationFrame(finish));
      setTimeout(finish, 120);
    });
  }

  // Counted, never typed. The sidebar footer learned this lesson already: a
  // hand-written total in narration is a claim that silently rots.
  function inventory() {
    const names = ["upstream", "production", "manufacturing", "storagePoints", "pipelines", "endUse"];
    const all = names.reduce((acc, key) => acc.concat((D[key] && D[key].features) || []), []);
    const unique = typeof uniqueInfrastructureProjects === "function" ? uniqueInfrastructureProjects(all) : all;
    return {
      mapped: unique.length + ((D.hubs && D.hubs.length) || 0),
      announced: (window.IEA_DATA && window.IEA_DATA.features && window.IEA_DATA.features.length) || 0
    };
  }

  // ---- Film chrome ---------------------------------------------------------
  // Built here rather than in index.html: none of it exists outside the film,
  // and markup hidden 99.9% of the time still costs every reader of the
  // document a moment working out when it appears.
  function buildChrome() {
    if (el("cine")) return el("cine");
    const root = document.createElement("div");
    root.id = "cine";
    root.setAttribute("role", "presentation");
    root.innerHTML = [
      '<div class="cine-bar cine-bar-top"></div>',
      '<div class="cine-bar cine-bar-bottom"></div>',
      '<div class="cine-vignette"></div>',
      '<div id="cine-boot" class="cine-boot">',
      '  <img class="cine-boot-mark" src="assets/h2elios-lockup.svg" alt="" />',
      '  <div id="cine-boot-lines" class="cine-boot-lines"></div>',
      '  <div class="cine-boot-bar"><div id="cine-boot-fill"></div></div>',
      '</div>',
      '<div id="cine-caption" class="cine-caption">',
      '  <div id="cine-kicker" class="cine-kicker"></div>',
      '  <div id="cine-headline" class="cine-headline"></div>',
      '</div>',
      '<div class="cine-progress"><div id="cine-progress-fill"></div></div>',
      '<button id="cine-exit" type="button" class="cine-exit" aria-label="Exit the film">Esc</button>'
    ].join("");
    document.body.appendChild(root);
    el("cine-exit").addEventListener("click", stop);
    return root;
  }

  function showCaption(kicker, headline) {
    const card = el("cine-caption");
    if (!card) return;
    card.classList.remove("is-in");
    // Force a reflow so re-showing a caption replays the entrance rather than
    // leaving the class on and animating nothing.
    void card.offsetWidth;
    el("cine-kicker").textContent = kicker;
    el("cine-headline").textContent = headline;
    card.classList.add("is-in");
  }

  // ---- Beats ---------------------------------------------------------------
  // Durations are the film's contract: they sum to the runtime the suite
  // asserts, and each beat's own motion finishes inside its own slot.
  const BEATS = [
    {
      id: "reveal",
      kicker: "H2ELIOS",
      headline: "Europe's hydrogen network, rendered live",
      ms: 11000,
      async run() {
        setFilters({});
        dock("facilities", true); dock("pipelines", true); dock("hubs", true);
        dock("announced", true); dock("flows", true);
        set3D(true);
        await settleShell();
        map.easeTo({ center: [9, 51], zoom: 3.1, pitch: 45, bearing: 0, duration: 9000 });
      }
    },
    {
      id: "corridors",
      kicker: "Supply corridors",
      headline: "Contracted hydrogen, moving between continents",
      ms: 15000,
      async run() {
        // The corridors are the only routes that are intercontinental —
        // Kakinada to Uniper is 7,452km — so the camera has to back off to
        // orbit distance for their apexes to read as arcs rather than smears
        // near the limb. The dense layers mute so the sweep stays legible.
        dock("announced", false);
        dock("facilities", false);
        await settleShell();
        map.easeTo({ center: [26, 34], zoom: 1.55, pitch: 52, bearing: -12, duration: 13000 });
      }
    },
    {
      id: "inspect",
      kicker: "Every node is a record",
      headline: "Shell Holland Hydrogen 1 — 200 MW, under construction",
      ms: 13000,
      async run() {
        dock("facilities", true);
        // Deliberately not diving past z6: capacity beams are sized for orbit
        // and at z7+ they fan into a starburst that buries the record this beat
        // is about. Toggling 3D off instead is not an option — that control
        // runs its own easeTo(pitch 0) and would fight this flight.
        await settleShell();
        map.flyTo({ center: [4.03, 51.95], zoom: 5.9, pitch: 52, bearing: 18, duration: 5200 });
        await wait(5400);
        openProject("Shell Holland Hydrogen 1");
      }
    },
    {
      id: "compare",
      kicker: "Compare",
      headline: "Two records open at once, without losing the map",
      ms: 14000,
      async run() {
        if (typeof pinCurrentProjectToComparison === "function") pinCurrentProjectToComparison();
        await wait(1400);
        map.flyTo({ center: [7.32, 52.51], zoom: 5.7, pitch: 48, bearing: -8, duration: 4200 });
        await wait(4400);
        openProject("GET H2 Lingen");
        await wait(1200);
        // Reopening the pinned record puts both on screen side by side, which
        // is the whole point of the tray and is invisible in a still.
        document.querySelector("#comparison-tray-items .comparison-open")?.click();
      }
    },
    {
      id: "ribbons",
      kicker: "Pipelines",
      headline: "Drawn as real geometry, not lines painted on a map",
      ms: 14000,
      async run() {
        closePanels();
        dock("pipelines", true);
        await settleShell();
        map.flyTo({ center: [8.4, 52.2], zoom: 5.6, pitch: 62, bearing: 26, duration: 6000 });
      }
    },
    {
      id: "filter",
      kicker: "Filter",
      headline: "The whole network answers, instantly",
      ms: 12000,
      async run() {
        map.easeTo({ center: [9, 51], zoom: 3.6, pitch: 48, bearing: 8, duration: 5200 });
        await wait(3200);
        setFilters({ color: "green" });
        await wait(4200);
        setFilters({ status: "operating" });
      }
    },
    {
      id: "network",
      kicker: "The full picture",
      headline: "",
      ms: 12000,
      async run() {
        setFilters({});
        dock("announced", true);
        await settleShell();
        map.easeTo({ center: [12, 44], zoom: 2.1, pitch: 30, bearing: -6, duration: 10000 });
      }
    },
    {
      id: "end",
      kicker: "H2ELIOS",
      headline: "Vanilla JavaScript · MapLibre · custom WebGL · Postgres",
      ms: 8000,
      run() {
        map.easeTo({ center: [9, 51], zoom: 1.9, pitch: 20, bearing: 0, duration: 7000 });
      }
    }
  ];

  const RUNTIME_MS = BEATS.reduce((total, beat) => total + beat.ms, 0);

  // ---- Playback ------------------------------------------------------------
  let playing = false;
  let idx = -1;
  let timer = null;
  let restore = null;

  function captureRestoreState() {
    return {
      dock: ["facilities", "pipelines", "fueling", "hubs", "announced", "flows"].map((layer) => [
        layer,
        Boolean(document.querySelector('.dock-btn[data-layer="' + layer + '"]')?.classList.contains("active"))
      ]),
      filters: {
        status: typeof statusFilter === "string" ? statusFilter : "all",
        color: typeof colorFilter === "undefined" ? null : colorFilter,
        region: typeof regionFilter === "string" ? regionFilter : "all"
      }
    };
  }

  async function runBoot() {
    const counts = inventory();
    const lines = [
      "Loading European infrastructure · " + counts.mapped.toLocaleString("en-US") + " assets",
      "Resolving supply corridors · " + ((D.flows && D.flows.length) || 0) + " contracted routes",
      "Building capacity geometry",
      "Ready"
    ];
    const host = el("cine-boot-lines");
    const fill = el("cine-boot-fill");
    host.innerHTML = "";
    for (let i = 0; i < lines.length; i++) {
      if (!playing) return;
      const row = document.createElement("div");
      row.className = "cine-boot-line";
      row.textContent = lines[i];
      host.appendChild(row);
      requestAnimationFrame(() => row.classList.add("is-in"));
      fill.style.width = (((i + 1) / lines.length) * 100) + "%";
      await wait(i === lines.length - 1 ? 700 : 1100);
    }
    el("cine-boot").classList.add("is-out");
    await wait(700);
  }

  async function playBeat(i) {
    idx = i;
    const beat = BEATS[i];
    // The network beat names live totals rather than carrying them as copy.
    const headline = beat.id === "network"
      ? inventory().mapped.toLocaleString("en-US") + " mapped assets · "
        + inventory().announced.toLocaleString("en-US") + " announced projects"
      : beat.headline;
    showCaption(beat.kicker, headline);
    el("cine-progress-fill").style.width =
      ((BEATS.slice(0, i + 1).reduce((t, b) => t + b.ms, 0) / RUNTIME_MS) * 100) + "%";
    try { await beat.run(); } catch (error) { console.warn('H2ELIOS film: beat "' + beat.id + '" failed', error); }
  }

  async function start() {
    if (playing) return;
    playing = true;
    restore = captureRestoreState();

    buildChrome();
    document.body.classList.add("cine-active");
    if (typeof setFocusMode === "function") setFocusMode(true);
    if (typeof navigateTo === "function") navigateTo("map");
    closePanels();

    await runBoot();
    if (!playing) return;

    for (let i = 0; i < BEATS.length && playing; i++) {
      await playBeat(i);
      if (!playing) return;
      await new Promise((resolve) => { timer = setTimeout(resolve, BEATS[i].ms); });
    }
    if (playing) stop();
  }

  function stop() {
    if (!playing && !el("cine")) return;
    playing = false;
    idx = -1;
    clearTimeout(timer);

    document.body.classList.remove("cine-active");
    const root = el("cine");
    if (root) root.remove();
    if (typeof setFocusMode === "function") setFocusMode(false);
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});

    closePanels();
    if (restore) {
      restore.dock.forEach((entry) => dock(entry[0], entry[1]));
      setFilters(restore.filters);
      restore = null;
    }
    if (typeof navigateTo === "function") navigateTo("map");
    if (typeof H2GRID_HOME_VIEW !== "undefined") {
      map.easeTo(Object.assign({}, H2GRID_HOME_VIEW, { duration: 1200 }));
    }
  }

  function wire() {
    const btn = el("demo-btn");
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.hidden = false;
    btn.addEventListener("click", () => {
      // requestFullscreen only resolves inside the gesture that triggered it,
      // so it cannot move into start()'s first await. A rejection is not fatal:
      // focus mode alone still gives the film the whole viewport.
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {});
      }
      start();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && playing) stop();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();

  window.H2GDemo = {
    start: start,
    stop: stop,
    get playing() { return playing; },
    get step() { return idx; },
    steps: BEATS.length,
    runtimeMs: RUNTIME_MS,
    beats: BEATS.map((b) => b.id)
  };
})();
