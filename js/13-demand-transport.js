/* ==========================================================================
   H2Grid · Demand & Transport Tab Module
   End-Use capacity aggregates, Carrier Logistics Simulators, and Offtaker Parity Catalogs.
   ======================================================================= */

// Illustrative fleet/orderbook trend - SAMPLE data, not a live feed. Fixed
// the same way as Market & Economics and the Technology tab's metals chart:
// no fake api.h2grid.org fetch, no Math.random() jitter dressed up as
// "Live", clearly badged in the UI instead.
const TRANSPORT_SAMPLE_DATA = {
  years: [2020, 2022, 2024, 2026, 2028, 2030, 2032, 2034],
  modes: {
    road: {
      label: "Heavy Road Transport (Trucks/Buses)",
      fleet: [8500, 12000, 18500, 26000, 48000, 95000, 190000, 350000],
      orders: [12000, 17500, 24000, 38000, 75000, 140000, 260000, 420000]
    },
    maritime: {
      label: "Maritime Cargo Carriers (NH3/H2)",
      fleet: [0, 2, 5, 12, 35, 90, 220, 480],
      orders: [2, 6, 18, 45, 110, 250, 490, 850]
    },
    aviation: {
      label: "Aviation (H2-combustion/Fuel Cell)",
      fleet: [0, 0, 1, 3, 8, 20, 50, 120],
      orders: [0, 1, 4, 10, 25, 60, 110, 220]
    }
  }
};

const SECTOR_PARITY_CATALOG = {
  steel: {
    name: "Green Steelmaking (DRI)",
    parity: "$1.50 / kg",
    volume: "High (~55 kg H2 per ton of crude steel)",
    offtakers: "Stegra (H2 Green Steel), SSAB (HYBRIT), Salzgitter",
    desc: "Replaces carbon monoxide with pure hydrogen inside Direct Reduced Iron (DRI) furnaces, venting steam instead of carbon dioxide."
  },
  ammonia: {
    name: "Green Ammonia & Fertilizer",
    parity: "$2.00 / kg",
    volume: "Extremely High (~177 kg H2 per ton of Ammonia)",
    offtakers: "Yara Clean Ammonia, CF Industries, Fertiglobe",
    desc: "Feeds green hydrogen directly into Haber-Bosch synthesis loops to replace steam methane reforming inputs."
  },
  aviation: {
    name: "Synthetic Aviation Fuels (SAF)",
    parity: "$3.50 / kg",
    volume: "Medium (depends on Fischer-Tropsch sizing)",
    offtakers: "Airbus (ZEROe), ZeroAvia, Neste",
    desc: "Pairs green hydrogen with captured carbon dioxide to refine drop-in paraffin kerosene alternatives."
  },
  shipping: {
    name: "Maritime e-Methanol / Ammonia",
    parity: "$2.50 / kg",
    volume: "High (carrier conversion density dependent)",
    offtakers: "Maersk (Dual-fuel container fleet), NYK Line",
    desc: "Feeds high-volume ammonia combustion and e-methanol propulsion systems for deep-sea cargo transport."
  }
};

let selectedSectorKey = "steel";
let transportChartInstance = null;

// Positioning for the offtaker opportunity matrix below: x from the
// catalog's own "$X.XX / kg" parity string, y from an ordinal rank of its
// "High"/"Extremely High"/etc volume label (the prefix before the
// parenthetical detail). Illustrative reference figures, same footing as
// the rest of SECTOR_PARITY_CATALOG - not a sourced/measured dataset, so
// the matrix is framed as directional, not a precision instrument.
const SECTOR_COLORS = { steel: "#60a5fa", ammonia: "#4ade80", aviation: "#f472b6", shipping: "#3fd6e8" };
// "Green Steelmaking" and "Green Ammonia" both start with the same word, so
// a short label auto-derived from SECTOR_PARITY_CATALOG's own name (first
// word) collided - explicit labels instead.
const SECTOR_SHORT_LABELS = { steel: "Steel", ammonia: "Ammonia", aviation: "SAF", shipping: "Maritime" };
const VOLUME_RANK = { "Medium": 1, "High": 2, "Extremely High": 3 };

function parseParity(str) {
  const m = String(str).match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 0;
}
function parseVolumeRank(str) {
  const label = String(str).split("(")[0].trim();
  return VOLUME_RANK[label] || 1;
}

function parseCapacityToMw(c) {
  if (!c || c === "n/a") return 0;
  let m = c.match(/([\d.]+)\s*GW/i);
  if (m) return parseFloat(m[1]) * 1000;
  m = c.match(/([\d.]+)\s*MW/i);
  if (m) return parseFloat(m[1]);
  m = c.match(/([\d.]+)\s*kt/i);
  if (m) return parseFloat(m[1]) * 16.6; 
  return 0;
}

const END_USE_CATEGORIES = ["Refining", "Ammonia", "Methanol", "Iron & Steel", "Mobility", "Power", "Grid & Blending", "Bio / Synfuels"];
// Reuses the same eight hex values 17-visualization.js already assigns to
// the hydrogen-colour taxonomy, so a category here and its swatch
// elsewhere in the app are drawn from one shared palette, not a second
// invented one.
const END_USE_COLOR = ["#34d399", "#4ade80", "#60a5fa", "#94a3b8", "#f472b6", "#a78bfa", "#2dd4bf", "#b45309"];

function aggregateEndUseCapacity() {
  const categories = {}; const counts = {};
  END_USE_CATEGORIES.forEach((c) => { categories[c] = 0; counts[c] = 0; });

  const feats = [];
  if (window.IEA_DATA) {
    feats.push(...window.IEA_DATA.features);
  }

  feats.forEach(f => {
    const p = f.properties;
    if (statusFilter !== "all" && p.statusClass !== statusFilter) return;
    if (regionFilter !== "all" && !(REGION_GROUPS[regionFilter] || []).includes(p.region)) return;

    const mw = parseCapacityToMw(p.capacity);
    if (mw <= 0) return;

    const bump = (key) => { categories[key] += mw; counts[key]++; };
    if (p.end_refining) bump("Refining");
    if (p.end_ammonia) bump("Ammonia");
    if (p.end_methanol) bump("Methanol");
    if (p.end_iron_steel) bump("Iron & Steel");
    if (p.end_mobility) bump("Mobility");
    if (p.end_power) bump("Power");
    if (p.end_grid_inj || p.end_chp || p.end_domestic_heat) bump("Grid & Blending");
    if (p.end_biofuels || p.end_synfuels) bump("Bio / Synfuels");
  });

  return { categories, counts };
}

// Demand landscape: each end-use sector is a territory rather than a bar —
// height still encodes capacity (the one thing the old bar chart showed),
// but width now also encodes how many projects make up that capacity, so
// "a lot of capacity from a few huge plants" and "the same capacity from
// many small ones" stop looking identical. No growth/glow channel: there is
// no real year-over-year figure for these categories to drive one honestly.
function renderDemandLandscape() {
  const el = document.getElementById("enduse-landscape");
  if (!el) return;

  const { categories, counts } = aggregateEndUseCapacity();
  const maxCap = Math.max(1, ...END_USE_CATEGORIES.map((c) => categories[c]));
  const maxCount = Math.max(1, ...END_USE_CATEGORIES.map((c) => counts[c]));

  const W = 640, H = 190, padX = 8, baseY = H - 24, maxBarH = 130;
  const colW = (W - padX * 2) / END_USE_CATEGORIES.length;

  const exactFeatureCount = (cat) => {
    const property = { Refining: "end_refining", Ammonia: "end_ammonia", Methanol: "end_methanol", "Iron & Steel": "end_iron_steel", Mobility: "end_mobility", Power: "end_power", "Grid & Blending": "end_grid_inj", "Bio / Synfuels": "end_synfuels" }[cat];
    return (window.IEA_DATA?.features || []).filter((feature) => {
      const p = feature.properties || {};
      return !Number(p.approx) && (Number(p[property]) || (cat === "Grid & Blending" && (Number(p.end_chp) || Number(p.end_domestic_heat))) || (cat === "Bio / Synfuels" && Number(p.end_biofuels)));
    }).length;
  };
  const bars = END_USE_CATEGORIES.map((cat, i) => {
    const cap = categories[cat], count = counts[cat];
    const h = cap > 0 ? 6 + (cap / maxCap) * maxBarH : 2;
    const w = count > 0 ? colW * 0.32 + (count / maxCount) * colW * 0.5 : colW * 0.18;
    const cx = padX + i * colW + colW / 2;
    const x = cx - w / 2;
    const y = baseY - h;
    const color = END_USE_COLOR[i % END_USE_COLOR.length];
    const mappedCount = exactFeatureCount(cat);
    return `<g class="landscape-territory${mappedCount ? " has-map-action" : ""}" data-demand-category="${escapeAttr(cat)}" ${mappedCount ? `tabindex="0" role="button" aria-label="Apply ${escapeAttr(cat)} cohort to map"` : ""}>
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${color}" fill-opacity="0.78"><title>${cat}: ${Math.round(cap).toLocaleString()} MWel across ${count} project${count === 1 ? "" : "s"}</title></rect>
      <text x="${cx.toFixed(1)}" y="${H - 10}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${color}" font-family="system-ui">${cat}</text>
    </g>`;
  }).join("");

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="demand-landscape-svg" role="img" aria-label="Hydrogen end-use capacity by sector, bar width shows project count, height shows capacity">
    <line x1="0" y1="${baseY}" x2="${W}" y2="${baseY}" stroke="rgba(120,160,200,0.15)" stroke-width="1"/>
    ${bars}
  </svg>`;
  el.querySelectorAll(".landscape-territory.has-map-action").forEach((territory) => {
    const open = () => window.beginMapHandoff?.({
      fromRoute: "demand-transport",
      label: "Demand",
      filters: { cohort: { type: "endUse", value: territory.dataset.demandCategory } },
      selectionId: null
    });
    territory.addEventListener("click", open);
    territory.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
  });
}

function renderTransportChart(data) {
  const ctx = document.getElementById("transport-chart");
  if (!ctx) return;

  const selectedMode = document.getElementById("t-mode-select").value;
  const modeData = data.modes[selectedMode] || data.modes.road;

  const chartConfig = {
    type: 'line',
    data: {
      labels: data.years,
      datasets: [
        {
          label: 'Supply (Active Fleet)',
          data: modeData.fleet,
          borderColor: '#4cc38a',
          backgroundColor: 'rgba(76, 195, 138, 0.04)',
          borderWidth: 2,
          fill: true,
          pointRadius: 2.5,
          tension: 0.2
        },
        {
          label: 'Demand (Cumulative Orders)',
          data: modeData.orders,
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.04)',
          borderWidth: 2,
          fill: true,
          pointRadius: 2.5,
          tension: 0.2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: 'rgba(120, 160, 200, 0.05)' },
          ticks: { color: '#67748c', font: { family: 'Inter', size: 9.5 } }
        },
        y: {
          grid: { color: 'rgba(120, 160, 200, 0.05)' },
          ticks: { color: '#67748c', font: { family: 'Inter', size: 9.5 } }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#b6c2d4', font: { family: 'system-ui', size: 10 } }
        }
      }
    }
  };

  if (transportChartInstance) transportChartInstance.destroy();
  transportChartInstance = new Chart(ctx, chartConfig);
}

// 1. Sliders Math: Hydrogen Carrier Transportation Logistics Calculator
function runTransportSim() {
  const dist = parseFloat(document.getElementById("calc-trans-dist").value);
  const payload = parseFloat(document.getElementById("calc-trans-payload").value);

  // Density & energy loss variables
  // LH2: ~71 kg/m3 density. Boil-off: ~0.15% per day. Liquefaction loss: 30% of energy.
  // Liquid NH3: ~680 kg/m3 density. Boil-off: 0%. Synthesis/Cracking loss: 38% of energy.
  // LOHC (Toluene-MCH): ~62 kg H2/m3 equivalent density. Dehydrogenation loss: 42% of energy.

  const shipSpeedKnots = 15;
  const shipSpeedKmh = shipSpeedKnots * 1.852;
  const transitDays = (dist / shipSpeedKmh) / 24;

  // LH2 Computations
  const lh2Vol = payload / 0.071; // m3
  const lh2BoilOff = payload * (1 - Math.pow(1 - 0.0015, transitDays)); // daily loss compounding
  const lh2LossPct = 30; // % energy loss

  // NH3 Computations
  const nh3PayloadTons = payload * 5.65; // Ammonia contains ~17.7 wt% H2
  const nh3Vol = nh3PayloadTons / 0.68;
  const nh3LossPct = 38;

  // LOHC Computations
  const lohcVol = payload / 0.062;
  const lohcLossPct = 42;

  // Update slider readouts
  document.getElementById("trans-dist-lbl").textContent = `${dist.toLocaleString()} km`;
  document.getElementById("trans-payload-lbl").textContent = `${payload.toLocaleString()} t H₂`;

  renderCarrierRouteCanvas({
    payload,
    volumes: { lh2: lh2Vol, nh3: nh3Vol, lohc: lohcVol },
    lh2BoilOff, lh2LossPct, nh3LossPct, lohcLossPct
  });
}

// Route canvas: each carrier's journey drawn as dispatch -> conversion loss
// -> (boil-off, LH2 only) -> delivered, replacing the old three-row table.
// Mass and energy loss are kept as two separate, honestly-labelled numbers
// rather than merged into one "system loss" figure — liquefaction/synthesis
// loss is energy consumed by the process, not hydrogen physically lost,
// and only LH2's boil-off actually reduces the delivered mass in this model.
const ROUTE_CARRIERS = [
  { key: "lh2", label: "Liquid H₂ (LH₂)", color: "#3fd6e8", processLabel: "Liquefaction", hasBoiloff: true },
  { key: "nh3", label: "Ammonia (NH₃)", color: "#a78bfa", processLabel: "Synthesis", hasBoiloff: false },
  { key: "lohc", label: "LOHC System", color: "#4ade80", processLabel: "Dehydrogenation", hasBoiloff: false }
];

function renderCarrierRouteCanvas({ payload, volumes, lh2BoilOff, lh2LossPct, nh3LossPct, lohcLossPct }) {
  const el = document.getElementById("carrier-route-canvas");
  if (!el) return;
  const lossPct = { lh2: lh2LossPct, nh3: nh3LossPct, lohc: lohcLossPct };

  el.innerHTML = ROUTE_CARRIERS.map((c) => {
    const delivered = c.hasBoiloff ? Math.max(0, payload - lh2BoilOff) : payload;
    return `<div class="route-row">
      <div class="route-label" style="color:${c.color}">${c.label}</div>
      <div class="route-track">
        <div class="route-stage route-origin">${payload.toLocaleString()} t<br><span>dispatched</span></div>
        <div class="route-arrow">→</div>
        <div class="route-stage route-process" style="border-color:${c.color}66; color:${c.color}">${c.processLabel}<br><span>−${lossPct[c.key]}% energy</span></div>
        ${c.hasBoiloff ? `<div class="route-arrow">→</div><div class="route-stage route-transit">Transit<br><span>−${lh2BoilOff.toFixed(1)} t boil-off</span></div>` : ""}
        <div class="route-arrow">→</div>
        <div class="route-stage route-destination" style="background:${c.color}1a; border-color:${c.color};">${delivered.toFixed(1)} t<br><span>delivered</span></div>
      </div>
      <div class="route-vol">${Math.round(volumes[c.key]).toLocaleString()} m³ needed</div>
    </div>`;
  }).join("");
}

// Offtaker parity leaderboard: sectors ranked as horizontal "race" bars
// instead of a scatter/spectrum of circular nodes (that shape is already
// used by the Technology tab's TRL spectrum right next door - reusing it
// here read as the same widget twice). A bar-leaderboard is a different
// visual grammar for the same two honest fields: bar fill length = how
// close the sector's price parity target is to the cheapest in the
// catalog (a relative "race to affordability", not an absolute physical
// unit), dot strength = demand volume rank. Sorted cheapest-first so the
// nearest-term opportunity naturally reads as "in the lead".
// Same $1.80/kg grey-hydrogen baseline the Policy tab's parity simulator
// uses, so "distance to grey" means the same dollar figure in both places
// instead of two tabs quietly disagreeing about what grey costs.
const GREY_BASELINE_LCOH = 1.80;

function renderOfftakerMatrix() {
  const el = document.getElementById("offtaker-matrix");
  if (!el) return;

  const keys = Object.keys(SECTOR_PARITY_CATALOG);
  const parities = keys.map((k) => parseParity(SECTOR_PARITY_CATALOG[k].parity));
  const pMin = Math.min(GREY_BASELINE_LCOH, ...parities), pMax = Math.max(GREY_BASELINE_LCOH, ...parities);
  const span = (pMax - pMin) || 1;
  const greyPct = Math.round((1 - (GREY_BASELINE_LCOH - pMin) / span) * 88) + 12;

  const ranked = [...keys].sort((a, b) => parseParity(SECTOR_PARITY_CATALOG[a].parity) - parseParity(SECTOR_PARITY_CATALOG[b].parity));

  const rowMarkup = ranked.map((key, i) => {
    const d = SECTOR_PARITY_CATALOG[key];
    const color = SECTOR_COLORS[key];
    const isActive = key === selectedSectorKey;
    const p = parseParity(d.parity);
    const pct = Math.round((1 - (p - pMin) / span) * 88) + 12; // 12-100%, so even the priciest sector still shows a visible bar
    const vol = parseVolumeRank(d.volume);
    const dots = [1, 2, 3].map((n) => `<span class="race-dot${n <= vol ? ' on' : ''}" style="--dot-color:${color}"></span>`).join("");
    const shortLabel = SECTOR_SHORT_LABELS[key] || key.toUpperCase();
    const gapLabel = p <= GREY_BASELINE_LCOH
      ? `$${(GREY_BASELINE_LCOH - p).toFixed(2)} below grey`
      : `$${(p - GREY_BASELINE_LCOH).toFixed(2)} above grey`;

    return `<div class="offtaker-race-row${isActive ? ' active' : ''}" data-sector="${key}" style="--race-color:${color}">
      <div class="race-rank">${i + 1}</div>
      <div class="race-info">
        <div class="race-label">${escapeHtml(shortLabel)}</div>
        <div class="race-sub">${escapeHtml(d.name)}</div>
      </div>
      <div class="race-track">
        <div class="race-fill" style="width:${pct}%;"></div>
        <div class="race-grey-marker" style="left:${greyPct}%" title="Grey hydrogen baseline: $${GREY_BASELINE_LCOH.toFixed(2)}/kg"></div>
      </div>
      <div class="race-meta">
        <span class="race-parity">${escapeHtml(d.parity)}</span>
        <span class="race-gap${p <= GREY_BASELINE_LCOH ? " under" : ""}">${gapLabel}</span>
        <span class="race-dots" title="Demand volume potential: ${escapeHtml(d.volume)}">${dots}</span>
      </div>
    </div>`;
  }).join("");

  el.innerHTML = `<div class="offtaker-race" role="list" aria-label="Offtaker sectors ranked by price parity target vs the grey-hydrogen baseline, dots show demand volume potential">${rowMarkup}</div>
    <div class="race-legend"><span class="race-grey-swatch"></span> Grey hydrogen baseline ($${GREY_BASELINE_LCOH.toFixed(2)}/kg)</div>`;

  el.querySelectorAll(".offtaker-race-row").forEach((row) => {
    row.addEventListener("click", () => selectSectorParity(row.dataset.sector));
  });
}

// 2. Interactive Sector catalog selection
function selectSectorParity(key) {
  selectedSectorKey = key;
  const d = SECTOR_PARITY_CATALOG[key];
  if (!d) return;

  renderOfftakerMatrix();

  const details = document.getElementById("sector-parity-details");
  if (details) {
    details.innerHTML = `
      <div style="background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-md); padding:14px; display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h4 style="font-size:12.5px; font-family:var(--font); color:var(--text-hi); margin:0;">${escapeHtml(d.name)}</h4>
          <span style="font-size:10.5px; font-weight:700; color:var(--cyan); background:rgba(63,214,232,0.1); border:1px solid rgba(63,214,232,0.3); padding:2px 8px; border-radius:12px;">Parity Target: ${escapeHtml(d.parity)}</span>
        </div>
        <dl style="display:grid; grid-template-columns:100px 1fr; gap:6px; font-size:11px; margin:0; line-height:1.4;">
          <dt style="color:var(--text-faint); font-weight:600; font-size:10.5px;">Intensity</dt>
          <dd style="color:var(--text-hi); font-weight:500; margin:0;">${escapeHtml(d.volume)}</dd>
          
          <dt style="color:var(--text-faint); font-weight:600; font-size:10.5px;">Key offtakers</dt>
          <dd style="color:var(--cyan); font-weight:600; margin:0;">${escapeHtml(d.offtakers)}</dd>
        </dl>
        <div style="border-top:1px solid var(--line); padding-top:8px; font-size:10.5px; line-height:1.4; color:var(--text-muted);">
          <strong style="color:var(--text-hi); font-size:10.5px;">Offtaker chemistry process:</strong>
          <div style="margin-top:2px;">${escapeHtml(d.desc)}</div>
        </div>
      </div>
    `;
    animateDetailIn(details);
  }
}

function initDemandTransportPage() {
  const el = document.getElementById("page-demand-transport");
  if (!el) return;

  el.innerHTML = `
    <div class="page-container" style="display:flex; flex-direction:column; gap:20px;">
      
      <!-- Page Header -->
      <div class="page-header" style="border-bottom: 1px solid var(--line); padding-bottom: 12px; margin-bottom: 8px;">
        <h2>Demand &amp; Transport</h2>
        <p>Hydrogen end-use allocations, carrier logistics volume comparisons, and sector economic parity benchmarks.</p>
      </div>

      <!-- Live state indicator row -->
      <div class="search-filter-row" style="display:flex; align-items:center; gap:12px; background:rgba(0,0,0,0.1); padding:10px 14px; border-radius:var(--r-md); border:1px solid var(--line);">
        <span style="font-size:11px; color:var(--text-muted);">Reactive capacity aggregation tracks active map bounds and status filters.</span>
      </div>

      <!-- Main Visual Grid -->
      <div class="demand-main-grid" style="display:grid; grid-template-columns: 1.1fr 0.9fr; gap:16px;">
        
        <!-- Left: End-use chart & Sector detail selection -->
        <div style="display:flex; flex-direction:column; gap:16px;">
          
          <!-- Demand landscape -->
          <div class="dashboard-card glass" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:10px;">
            <h3 style="font-size:14px; font-family:var(--font); color:var(--text-hi);">Hydrogen End-Use Capacity Distribution</h3>
            <p style="font-size:10.5px; color:var(--text-faint); line-height:1.4; margin:-6px 0 0;">Each territory's height is that sector's tracked capacity; its width is how many projects make it up.</p>
            <div id="enduse-landscape" class="svg-viz-wrap"></div>
          </div>

          <!-- Sector catalog -->
          <div class="dashboard-card glass" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:12px;">
            <h3 style="font-size:14px; font-family:var(--font); color:var(--text-hi);">Offtaker Parity Race</h3>
            <p style="font-size:10.5px; color:var(--text-faint); line-height:1.4; margin:-6px 0 0;">Illustrative reference figures, ranked cheapest-to-unlock first. Bar length = proximity to the catalog's lowest price parity target; dots = demand volume potential. Click a sector for detail.</p>

            <div id="offtaker-matrix"></div>

            <div id="sector-parity-details">
              <!-- Filled dynamically -->
            </div>
          </div>

        </div>

        <!-- Right: Transport fleets & Carrier Logistics Simulator -->
        <div style="display:flex; flex-direction:column; gap:16px;">
          
          <!-- Line Chart -->
          <div class="dashboard-card glass" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h3 style="font-size:14px; font-family:var(--font); color:var(--text-hi);">Fleet Rollout Orderbooks <span class="badge badge-sample">Sample</span></h3>
              <select id="t-mode-select" style="background:var(--bg-1); color:var(--text-hi); border:1px solid var(--line); padding:2px 6px; border-radius:4px; font-size:11px; height:auto; margin:0;">
                <option value="road">🚛 Heavy Road Fleet</option>
                <option value="maritime">🚢 Cargo Vessels</option>
                <option value="aviation">✈ Aviation Prototypes</option>
              </select>
            </div>
            <div class="chart-wrapper" style="height: 150px; position:relative; background:rgba(0,0,0,0.15); border:1px solid var(--line); border-radius:var(--r-sm);">
              <canvas id="transport-chart"></canvas>
            </div>
          </div>

          <!-- Carrier Logistics Simulator -->
          <div class="dashboard-card glass" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:10px;">
            <h3 style="font-size:14px; font-family:var(--font); color:var(--text-hi);">Hydrogen Carrier Transport Simulator</h3>
            <p style="font-size:11px; color:var(--text-muted); line-height:1.4; margin:0;">
              Compare liquefaction volumes, transshipment boil-off, and roundtrip energy conversion losses across major ocean carriers.
            </p>
            <details class="model-assumptions"><summary>Model assumptions and inputs</summary><p>15-knot voyage speed; LH₂ density 71 kg/m³ and 0.15% daily boil-off; ammonia at 17.7 wt% hydrogen; route-process energy-loss assumptions of 30% LH₂, 38% NH₃ and 42% LOHC. Outputs are comparative modeled estimates.</p></details>

            <div style="display:flex; flex-direction:column; gap:10px; background:rgba(0,0,0,0.15); padding:10px 12px; border-radius:var(--r-md); border:1px solid var(--line);">
              <!-- Input 1 -->
              <div style="display:flex; flex-direction:column; gap:2px;">
                <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-hi);">
                  <span>Voyage Distance</span>
                  <span id="trans-dist-lbl" style="font-weight:600; color:var(--cyan);">5,000 km</span>
                </div>
                <input type="range" id="calc-trans-dist" min="500" max="15000" step="500" value="5000" style="accent-color:var(--cyan); cursor:pointer;" />
              </div>

              <!-- Input 2 -->
              <div style="display:flex; flex-direction:column; gap:2px;">
                <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-hi);">
                  <span>H₂ Net Payload</span>
                  <span id="trans-payload-lbl" style="font-weight:600; color:var(--cyan);">100 t H₂</span>
                </div>
                <input type="range" id="calc-trans-payload" min="10" max="500" step="10" value="100" style="accent-color:var(--cyan); cursor:pointer;" />
              </div>
            </div>

            <!-- Route canvas -->
            <div id="carrier-route-canvas" class="route-canvas"></div>

          </div>

        </div>

      </div>

    </div>
  `;

  // Bind Simulator events
  document.getElementById("calc-trans-dist").oninput = runTransportSim;
  document.getElementById("calc-trans-payload").oninput = runTransportSim;
  runTransportSim();

  // Select initial DRI Steel sector catalog tab
  selectSectorParity("steel");

  // Render static derived end-use capacity bars
  renderDemandLandscape();

  renderTransportChart(TRANSPORT_SAMPLE_DATA);
  // Linked selection: picking a fleet mode with a clear offtaker-sector
  // counterpart also selects that sector below, so the two panels move
  // together instead of sitting as two unrelated controls on the same
  // page. Road has no clean single-sector match in the parity catalog, so
  // it's left alone rather than guessing one.
  const FLEET_TO_SECTOR = { maritime: "shipping", aviation: "aviation" };
  document.getElementById("t-mode-select").onchange = (e) => {
    renderTransportChart(TRANSPORT_SAMPLE_DATA);
    const sector = FLEET_TO_SECTOR[e.target.value];
    if (sector) selectSectorParity(sector);
  };

  animateCardsIn(el);
}
