/* ==========================================================================
   H2Grid · Feature demo
   A self-playing walkthrough of what the globe can DO. Supersedes the
   older, separate project-narration "Tour" card (06-tour.js, removed).

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

  function set3D(on) {
    if (!!window.is3DActive === !!on) return;
    const btn = document.getElementById("dock-3d-btn");
    if (btn) btn.click();
  }

  // Each panel owns real teardown: toolbar button state, markets polling, the
  // YouTube iframe, the chart instance, the map selection ring and selectedName.
  // Setting .hidden directly skipped all of it, so the walkthrough left behind
  // stuck buttons, a poller still running and a video still playing off-screen.
  function closePanels() {
    if (typeof closeAnalyticsPanel === "function") closeAnalyticsPanel();
    if (typeof closeMarketsPanel === "function") closeMarketsPanel();
    if (typeof closeDetailPanel === "function" && !document.getElementById("detail-card")?.hidden) {
      closeDetailPanel(false); // no focus restore: nothing here took focus
    }
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

  // Navigate by route id, never by visible label. Labels are product copy and
  // have already been renamed underneath this file once — Market -> Economics,
  // Temporal -> Timeline, Tools -> Calculator, Map -> Explore — which silently
  // turned matching steps into no-ops. Route ids are the stable contract.
  //
  // Falls back to the tab button's data-route only if the router is missing.
  function showRoute(route) {
    if (typeof navigateTo === "function") {
      // Canonical form is "#map", not "#/map" — that is what every other
      // location.hash write in the app produces and what the tests assert.
      if (location.hash.replace(/^#\/?/, "") !== route) location.hash = route;
      navigateTo(route);
      return true;
    }
    const btn = document.querySelector(`#tab-nav .tab-btn[data-route="${route}"]`);
    if (btn) btn.click();
    return !!btn;
  }

  // Ten steps, each route-addressed and each demonstrating something the build
  // actually still does. The previous script had drifted badly: it drove a
  // "flows" dock control that no longer exists, narrated a solar terminator and
  // 3D supply-chain arcs whose scripts are no longer loaded, visited the hidden
  // prototype workspace, and navigated by labels that had since been renamed.
  const STEPS = [
    {
      title: "The world's hydrogen build-out",
      text: "Every spike is a real project, and its height is that project's production capacity. Thousands of announced facilities from the IEA database plus hand-verified nodes — each traceable to a cited source.",
      hold: 8000,
      route: "map",
      async run() {
        closePanels();
        setFilters({});
        set3D(true);
        await wait(300);
        map.flyTo({ center: [9, 46], zoom: 3.0, pitch: 64, bearing: -14, duration: 3400, essential: true });
      }
    },
    {
      title: "The colours are the chemistry",
      text: "Hydrogen is classified by how it is made: green is renewable electrolysis, blue is gas with carbon capture, pink is nuclear, brown is coal. Filter to green alone and most of the announced pipeline is still standing.",
      hold: 7000,
      route: "map",
      async run() {
        setFilters({ color: "green" });
        map.flyTo({ center: [9, 48], zoom: 2.9, pitch: 58, bearing: 8, duration: 2600, essential: true });
      }
    },
    {
      title: "Announced is not built",
      text: "Filter by status and the story changes sharply. Only a small fraction of announced capacity has ever reached construction — this is the filter that separates a press release from a plant.",
      hold: 7000,
      route: "map",
      async run() {
        setFilters({ status: "operating" });
        map.flyTo({ center: [20, 35], zoom: 2.2, pitch: 45, bearing: 0, duration: 2600, essential: true });
      }
    },
    {
      title: "Live viewport analytics",
      text: "The Insights panel is scoped to whatever is on screen. Pan or zoom and the project count, the capacity in view and the share-of-network gauge all recompute against the backend for exactly that viewport.",
      hold: 8500,
      route: "map",
      async run() {
        setFilters({});
        set3D(false);
        const btn = document.getElementById("analytics-btn");
        if (btn && document.getElementById("analytics-panel")?.hidden !== false) btn.click();
        map.flyTo({ center: [8, 50], zoom: 4.2, pitch: 30, bearing: 0, duration: 2600, essential: true });
      }
    },
    {
      title: "And the markets that fund it",
      text: "Live quotes for the listed hydrogen sector — electrolyser makers, fuel-cell firms and the industrial-gas majors — beside a running finance broadcast, proxied through the backend so no API key reaches the browser.",
      hold: 8000,
      route: "map",
      async run() {
        setFilters({});
        closePanels();
        const btn = document.getElementById("markets-btn");
        if (btn && document.getElementById("markets-panel")?.hidden !== false) btn.click();
        map.flyTo({ center: [15, 25], zoom: 2.0, pitch: 20, bearing: 0, duration: 2800, essential: true });
      }
    },
    {
      title: "Economics",
      text: "Break-even hydrogen prices by country and sector, an LCOH sensitivity model you can drag, and the funding behind the sector.",
      hold: 6500,
      route: "market",
      async run() { closePanels(); setFilters({}); showRoute("market"); }
    },
    {
      title: "Technology",
      text: "The electrolyser mix — alkaline, PEM, SOEC and AEM — with technology-readiness levels, efficiency ranges, and the critical-material exposure limiting each one.",
      hold: 6500,
      route: "technology",
      async run() { showRoute("technology"); }
    },
    {
      title: "Demand & transport",
      text: "Where the molecules actually go: refining, ammonia, steel and mobility — plus carrier logistics comparing liquid hydrogen, ammonia and LOHC on the volumes that matter.",
      hold: 6500,
      route: "demand-transport",
      async run() { showRoute("demand-transport"); }
    },
    {
      title: "Policy",
      text: "The regulation that decides whether any of this gets built — subsidy frameworks, tariff rules, and the recent changes reshaping each region's economics.",
      hold: 6500,
      route: "policy",
      async run() { showRoute("policy"); }
    },
    {
      title: "Timeline, then the Calculator",
      text: "Scrub a year to see which projects come online and how the build-out curve bends. The Calculator then closes the loop: unit conversion, stack efficiency, CAPEX/OPEX and levelised cost, all recomputing live.",
      hold: 7000,
      route: "tools",
      async run() {
        showRoute("timeline");
        await wait(1800);
        showRoute("tools");
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
    el("demo-play").setAttribute("aria-label", playing ? "Pause walkthrough" : "Resume walkthrough");
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
    // Leave the app on Explore in a clean, usable state rather than wherever
    // the last step happened to stop — the final steps end on a studio route.
    showRoute("map");
    closePanels();
    document.querySelectorAll("#snapshot-row .detail-snapshot, #minimized-tray .mini-card").forEach((el) => el.remove());
    openSnapshots.length = 0;
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

  // `routes` lets tests assert that every step lands on the workspace it claims
  // without having to scrape narration copy.
  window.H2GDemo = {
    start, stop, go,
    get step() { return idx; },
    steps: STEPS.length,
    routes: STEPS.map((s) => s.route)
  };
})();
