/* ==========================================================================
   H2Grid · Guided tour
   10-stop cinematic fly-through.
   Browser classic scripts share one global lexical scope, so map, helpers &
   state from core are visible here. Load order matters — see index.html.
   ======================================================================= */

// ---- Guided tour -----------------------------------------------------------------------------------------
const TOUR = [
  {
    title: "Welcome to H₂Grid — the world's hydrogen network",
    text: "One rotating globe, five regions, ~170 nodes. Node size = capacity; solid = operating, ringed = building, hollow = planned, red = at risk. The context: of 520 GW announced globally, only 4–7% has ever reached construction. This globe shows who's actually building.",
    center: [15, 20], zoom: 1.7, pitch: 0
  },
  {
    title: "1 · Utah: the chain, proven",
    text: "Delta, Utah packs the whole value chain into one spot — and as of Feb 2026 it works: ACES' 220 MW of electrolyzers hit 100% load, hydrogen rests in 300 GWh salt caverns, and the IPP Renewed plant burns it for Los Angeles. The world's first proof of seasonal H₂ storage at scale.",
    center: [-112.58, 39.44], zoom: 9.8, pitch: 45
  },
  {
    title: "2 · The US correction",
    text: "The same year delivered casualties: Plug Power abandoned STAMP — designed as North America's largest green H₂ plant — selling the site to a data-center developer in March 2026. ExxonMobil's Baytown blue-H₂ flagship sits paused. DOE terminated the ARCHES and PNWH2 hub awards; ARCH2 kept its $925M.",
    center: [-88, 37], zoom: 4.2, pitch: 20
  },
  {
    title: "3 · Gulf Coast: still the incumbent heartland",
    text: "Texas and Louisiana run the world's densest existing hydrogen network — 900+ miles of pipeline, salt caverns, SMR plants, and Air Products' $7B+ Louisiana blue complex still building. The HyVelocity hub anchors on all of it.",
    center: [-94.3, 29.9], zoom: 7.6, pitch: 40
  },
  {
    title: "4 · Europe: regulation builds demand",
    text: "Europe holds the most capacity past FID, pushed by RED III mandates (42% renewable H₂ in industry by 2030). Rotterdam is the gateway: Shell's Holland Hydrogen 1, twin blue-H₂ plants, the first Hynetwork pipeline segment live in 2026 — feeding a planned 5,800 km German Kernnetz.",
    center: [5.5, 51.5], zoom: 6.4, pitch: 35
  },
  {
    title: "5 · Steel is the anchor customer",
    text: "In Boden, Sweden, Stegra installed the final modules of Europe's largest electrolyzer array (700+ MW) in April 2026 to make near-zero steel — pre-sold to Porsche, Mercedes, Volvo, IKEA and Microsoft. Duisburg's tkH2Steel and HYBRIT follow. Industry, not cars, is buying the molecules.",
    center: [17, 61], zoom: 4.4, pitch: 30
  },
  {
    title: "6 · NEOM: the desert benchmark",
    text: "Saudi Arabia's NEOM is 90% built: 4 GW of dedicated wind and solar feeding 2+ GW of electrolyzers, 600 t/day of green H₂ — 100% contracted to Air Products for 30 years, first ammonia export locked for 2027. Oman and Egypt follow; Egypt Green already operates and won H2Global's first auction.",
    center: [37, 25], zoom: 4.6, pitch: 35
  },
  {
    title: "7 · China builds at record scale",
    text: "Sinopec's Kuqa (260 MW) is the world's largest operating green-H₂ plant — though it ran at ~20% utilization for two years, a lesson in solar-integration reality. Ordos rises bigger. And the violet nodes: China's gigafactories (PERIC 6.5 GW/yr, LONGi, Sungrow) pushed stack prices below $400/kW.",
    center: [105, 38], zoom: 3.8, pitch: 30
  },
  {
    title: "8 · Molecules cross oceans",
    text: "Watch the arcs wrap the globe: Australia→Kobe liquid H₂ (world-first voyages), India→Europe 500 kt/yr ammonia for Uniper, Egypt→Rotterdam under H2Global, NEOM→everywhere, Nova Scotia→Germany with EU subsidies. Ammonia — not liquid hydrogen — is winning as the carrier.",
    center: [60, 15], zoom: 2.2, pitch: 15
  },
  {
    title: "9 · The reality check, mapped",
    text: "Red rings mark the FID graveyard: bp exited the 26 GW AREH and cancelled H2Teesside; Shell dropped Aukra; Australia lost CQ-H2 and Whyalla; Newfoundland pulled World Energy GH2's land. Projects with real offtake, subsidy and industrial logic survive. Explore — spin the globe, click anything.",
    center: [15, 20], zoom: 1.7, pitch: 0
  }
];

let tourIdx = -1;

function wireTour() {
  const card = document.getElementById("tour-card");
  document.getElementById("tour-btn").addEventListener("click", () => { stopSpin(); tourIdx = -1; tourNext(); });
  document.getElementById("tour-next").addEventListener("click", tourNext);
  document.getElementById("tour-prev").addEventListener("click", () => { tourIdx = Math.max(0, tourIdx - 2); tourNext(); });
  document.getElementById("tour-exit").addEventListener("click", () => {
    card.hidden = true;
    tourIdx = -1;
    map.flyTo({ center: [15, 20], zoom: 1.7, pitch: 0, bearing: 0, duration: 1800 });
  });
}

function tourNext() {
  const card = document.getElementById("tour-card");
  tourIdx++;
  if (tourIdx >= TOUR.length) {
    card.hidden = true;
    tourIdx = -1;
    return;
  }
  const step = TOUR[tourIdx];
  document.getElementById("detail-card").hidden = true;
  document.getElementById("tour-title").textContent = step.title;
  document.getElementById("tour-text").textContent = step.text;
  document.getElementById("tour-step-label").textContent = `${tourIdx + 1} / ${TOUR.length}`;
  document.getElementById("tour-next").textContent = tourIdx === TOUR.length - 1 ? "Finish ✓" : "Next →";
  document.getElementById("tour-progress").innerHTML =
    TOUR.map((_, i) => `<div class="tour-dot ${i <= tourIdx ? "done" : ""}"></div>`).join("");
  card.hidden = false;
  map.flyTo({ center: step.center, zoom: step.zoom, pitch: step.pitch || 0, bearing: 0, duration: 2400, essential: true });
}
