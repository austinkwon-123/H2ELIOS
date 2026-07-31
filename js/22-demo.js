/* ==========================================================================
   H2Grid · Feature demo
   A self-playing walkthrough of what the globe can DO, as opposed to
   06-tour.js, which walks through hydrogen projects and what they mean.

   Every step drives the real controls — the same globals the dock buttons and
   filter flyouts write to — rather than faking a visual. What you watch is the
   product working, so the demo can never drift out of sync with the app the
   way a scripted video would.

   Browser classic scripts share one global lexical scope, so map, helpers &
   state from core/filters are visible here. Load after 17-visualization.js
   (window.is3DActive, #dock-3d-btn) and 20-spikes.js (window.H2GSpikes).
   ======================================================================= */
(function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  function setDock(layerKey, on) {
    const btn = document.querySelector(`.dock-btn[data-layer="${layerKey}"]`);
    if (!btn) return;
    if (btn.classList.contains("active") !== on) btn.click();
  }

  function set3D(on) {
    if (!!window.is3DActive === !!on) return;
    const btn = document.getElementById("dock-3d-btn");
    if (btn) btn.click();
  }

  function closePanels() {
    ["analytics-panel", "markets-panel", "detail-card"].forEach((id) => {
      const el = document.getElementById(id);
      if (el && !el.hidden) el.hidden = true;
    });
  }

  // Filters are plain globals owned by 03-filters.js; applyFilters() is the
  // single re-render entry point the rest of the app already uses.
  function setFilters({ status = "all", color = null, region = "all" } = {}) {
    statusFilter = status;
    colorFilter = color;
    regionFilter = region;
    applyFilters();
    // The regional AI panel keys off regionFilter and is not driven by
    // applyFilters, so it has to be nudged explicitly.
    if (typeof updateRegionalAIPanel === "function") updateRegionalAIPanel();
    if (window.is3DActive) update3DTowers();
  }

  // Tabs are ordinary buttons in the #tab-nav island; matching on the visible
  // label keeps this readable and survives the buttons being reordered.
  function showTab(labelStarts) {
    const btn = [...document.querySelectorAll("#tab-nav .tab-btn")]
      .find((b) => (b.textContent || "").trim().toLowerCase().startsWith(labelStarts.toLowerCase()));
    if (btn) btn.click();
    return !!btn;
  }

  const STEPS = [
    {
      title: "The network",
      text: "3,338 announced projects from the IEA database plus 138 hand-verified nodes, on one globe. Every mark is a real facility with a citation — nothing here is filler.",
      async run() {
        closePanels();
        setFilters({});
        set3D(false);
        map.flyTo({ center: [15, 20], zoom: 1.75, pitch: 0, bearing: 0, duration: 2600, essential: true });
      }
    },
    {
      title: "Capacity, as elevation",
      text: "Switch to volumetric mode and every project becomes a beam whose height encodes its production capacity — 107 km for a small pilot, 1,587 km for a gigawatt plant. Density you can read at a glance.",
      async run() {
        setFilters({});
        set3D(true);
        await wait(400);
        map.flyTo({ center: [9, 48], zoom: 3.1, pitch: 62, bearing: -12, duration: 3000, essential: true });
      }
    },
    {
      title: "The colours are the chemistry",
      text: "Hydrogen is classified by how it is made. Green is renewable electrolysis, blue is gas with carbon capture, pink is nuclear, brown is coal. Watch the network filter down to green only — 79% of the announced pipeline.",
      async run() {
        setFilters({ color: "green" });
        map.flyTo({ center: [9, 48], zoom: 2.9, pitch: 58, bearing: 8, duration: 2600, essential: true });
      }
    },
    {
      title: "Blue, and the incumbents",
      text: "Now blue — steam methane reforming with carbon capture. Far fewer projects, but they carry disproportionate capacity, and they cluster where the gas infrastructure already is.",
      async run() {
        setFilters({ color: "blue" });
        map.flyTo({ center: [-70, 33], zoom: 2.6, pitch: 55, bearing: -10, duration: 2800, essential: true });
      }
    },
    {
      title: "Announced is not built",
      text: "Filter by status and the story changes. Of 520 GW announced globally, only 4–7% has ever reached construction. This is the filter that separates a press release from a plant.",
      async run() {
        setFilters({ status: "operating" });
        map.flyTo({ center: [20, 35], zoom: 2.2, pitch: 45, bearing: 0, duration: 2600, essential: true });
      }
    },
    {
      title: "Sunlight is the constraint",
      text: "The terminator is computed from the real solar position, updated every minute. Green hydrogen runs on solar and wind, so the lit hemisphere is the production window — and the bright dot is where the sun is directly overhead right now.",
      async run() {
        setFilters({});
        set3D(false);
        map.flyTo({ center: [40, 15], zoom: 1.7, pitch: 0, bearing: 0, duration: 3000, essential: true });
      }
    },
    {
      title: "Supply chains, in 3D",
      text: "The arcs are real contracted corridors from the curated dataset, drawn as true elevated geometry rather than lines painted on the surface — height and width scale with each route's great-circle distance.",
      async run() {
        setFilters({});
        setDock("flows", true);
        set3D(true);
        map.flyTo({ center: [30, 30], zoom: 2.3, pitch: 60, bearing: 15, duration: 3000, essential: true });
      }
    },
    {
      title: "Zoom in and clusters resolve",
      text: "The IEA tier clusters at distance and breaks apart as you descend, so 3,338 records stay legible from orbit and individually clickable up close.",
      async run() {
        setFilters({});
        set3D(true);
        map.flyTo({ center: [6.9, 51.5], zoom: 6.2, pitch: 50, bearing: -20, duration: 3200, essential: true });
      }
    },
    {
      title: "Live analytics",
      text: "The panel is scoped to whatever is on screen. Pan or zoom and the project count, capacity and technology split recompute against the backend for exactly that viewport.",
      async run() {
        setFilters({});
        const btn = document.getElementById("analytics-btn");
        if (btn && document.getElementById("analytics-panel")?.hidden !== false) btn.click();
        map.flyTo({ center: [8, 50], zoom: 4.2, pitch: 30, bearing: 0, duration: 2600, essential: true });
      }
    },
    {
      title: "And the markets that fund it",
      text: "Live quotes for the listed hydrogen sector — electrolyser makers, fuel-cell firms and the industrial-gas majors — pulled through the backend so no API key is ever exposed to the browser.",
      async run() {
        setFilters({});
        closePanels();
        const btn = document.getElementById("markets-btn");
        if (btn && document.getElementById("markets-panel")?.hidden !== false) btn.click();
        map.flyTo({ center: [15, 25], zoom: 2.0, pitch: 20, bearing: 0, duration: 2800, essential: true });
      }
    },
    {
      title: "Regional AI synthesis",
      text: "Narrow to a region and the system writes a briefing for it — investment scale, anchor projects, and the bottleneck that actually constrains build-out there. Cached per region so it is instant on return.",
      hold: 8000,
      async run() {
        closePanels();
        setFilters({ region: "europe" });
        map.flyTo({ center: [10, 50], zoom: 3.4, pitch: 40, bearing: 0, duration: 2600, essential: true });
      }
    },

    // ---- Beyond the globe: the analysis tabs --------------------------------
    {
      title: "Market & economics",
      text: "Real break-even hydrogen prices by country and sector from the IPCEI Clean Hydrogen Observatory, plus an LCOH sensitivity model and the funding rounds behind the sector.",
      hold: 6500,
      async run() { closePanels(); setFilters({}); showTab("Market"); }
    },
    {
      title: "Technology",
      text: "The electrolyser mix — alkaline, PEM, SOEC, AEM — with technology-readiness levels, efficiency ranges, catalyst commodity exposure, and the bottleneck limiting each one.",
      hold: 6500,
      async run() { showTab("Technology"); }
    },
    {
      title: "Demand & transport",
      text: "Where the molecules actually go: refining, ammonia, steel, mobility. Plus carrier logistics — liquid hydrogen against ammonia against LOHC, compared on the volume that matters.",
      hold: 6500,
      async run() { showTab("Demand"); }
    },
    {
      title: "Policy",
      text: "The regulation that decides whether any of this gets built — subsidy frameworks, tariff guidelines, and the recent policy changes reshaping each region's economics.",
      hold: 6500,
      async run() { showTab("Policy"); }
    },
    {
      title: "Temporal sandbox",
      text: "Drag a year and the whole network resolves to that moment — which projects are online, how much capacity exists, and how the build-out curve actually bends between now and 2035.",
      hold: 7000,
      async run() { showTab("Temporal"); }
    },
    {
      title: "Companies & partners",
      text: "A registry of the developers, EPC contractors and technology providers behind the projects, so a node on the globe connects to the people who would actually build it.",
      hold: 6000,
      async run() { showTab("Companies"); }
    },
    {
      title: "Tools",
      text: "Five live engineering models — unit conversion, stack efficiency, CAPEX/OPEX, levelised cost of hydrogen, and current density. Drag any input and every dependent figure recomputes.",
      hold: 6500,
      async run() { showTab("Tools"); }
    },
    {
      title: "That's H₂Grid",
      text: "3,338 announced projects, 138 verified nodes, live market data and eight analysis surfaces — every figure traceable to a cited source. Back to the globe.",
      hold: 6000,
      async run() {
        showTab("Map");
        setFilters({});
        set3D(true);
        await wait(600);
        map.flyTo({ center: [12, 40], zoom: 2.6, pitch: 56, bearing: -12, duration: 3000, essential: true });
      }
    }
  ];

  let idx = -1;
  let timer = null;
  let playing = false;

  const el = (id) => document.getElementById(id);

  function renderCard() {
    const step = STEPS[idx];
    el("demo-title").textContent = step.title;
    el("demo-text").textContent = step.text;
    el("demo-step-label").textContent = `${idx + 1} / ${STEPS.length}`;
    el("demo-progress").innerHTML = STEPS.map((_, i) =>
      `<div class="tour-dot ${i <= idx ? "done" : ""}"></div>`).join("");
    el("demo-play").textContent = playing ? "❚❚" : "▶";
    el("demo-play").title = playing ? "Pause" : "Play";
  }

  async function go(i) {
    clearTimeout(timer);
    idx = Math.max(0, Math.min(STEPS.length - 1, i));
    el("demo-card").hidden = false;
    renderCard();
    stopSpin();
    await STEPS[idx].run();
    // Auto-advance while playing. Globe steps hold longer because the camera
    // flight is most of what there is to watch; tab steps declare their own
    // shorter hold since they land instantly.
    if (playing) timer = setTimeout(() => {
      if (idx >= STEPS.length - 1) stop();
      else go(idx + 1);
    }, STEPS[idx].hold || 7200);
  }

  function start() {
    playing = true;
    go(0);
  }

  function stop() {
    clearTimeout(timer);
    playing = false;
    idx = -1;
    el("demo-card").hidden = true;
    // Leave the app on the globe in a clean, usable state rather than wherever
    // the last step happened to stop — including on another tab.
    showTab("Map");
    closePanels();
    setFilters({});
    set3D(true);
    renderCardSafe();
  }

  function renderCardSafe() {
    try { if (idx >= 0) renderCard(); } catch (e) { /* card is hidden */ }
  }

  function togglePlay() {
    playing = !playing;
    renderCard();
    if (playing) go(idx < 0 ? 0 : idx);
    else clearTimeout(timer);
  }

  function wire() {
    const btn = el("demo-btn");
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", start);
    el("demo-play").addEventListener("click", togglePlay);
    el("demo-next").addEventListener("click", () => { clearTimeout(timer); go(idx + 1); });
    el("demo-prev").addEventListener("click", () => { clearTimeout(timer); go(idx - 1); });
    el("demo-exit").addEventListener("click", stop);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", wire);
  else wire();

  window.H2GDemo = { start, stop, go, get step() { return idx; }, steps: STEPS.length };
})();
