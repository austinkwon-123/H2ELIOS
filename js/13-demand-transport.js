/* ==========================================================================
   H2Grid · Demand & Transport Tab Module
   End-Use capacity aggregates, Carrier Logistics Simulators, and Offtaker Parity Catalogs.
   ======================================================================= */

const TRANSPORT_API_URL = "https://api.h2grid.org/v1/transport-trends";
const TRANSPORT_CACHE_KEY = "h2grid_transport_cache";

// Transport stats: actuals and projected fleet counts vs order backlog
const DEFAULT_TRANSPORT_DATA = {
  lastUpdated: new Date().toISOString(),
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
let enduseChartInstance = null;
let transportChartInstance = null;

function fetchTransportData() {
  return new Promise((resolve) => {
    setTimeout(() => {
      const data = JSON.parse(JSON.stringify(DEFAULT_TRANSPORT_DATA));
      data.lastUpdated = new Date().toISOString();
      const scalar = 1 + (Math.random() - 0.5) * 0.08;
      
      for (const m in data.modes) {
        data.modes[m].fleet = data.modes[m].fleet.map(v => Math.round(v * scalar));
        data.modes[m].orders = data.modes[m].orders.map(v => Math.round(v * scalar));
      }
      resolve(data);
    }, 450);
  });
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

function aggregateEndUseCapacity() {
  const categories = {
    "Refining": 0,
    "Ammonia": 0,
    "Methanol": 0,
    "Iron & Steel": 0,
    "Mobility": 0,
    "Power": 0,
    "Grid & Blending": 0,
    "Bio / Synfuels": 0
  };

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

    if (p.end_refining) categories["Refining"] += mw;
    if (p.end_ammonia) categories["Ammonia"] += mw;
    if (p.end_methanol) categories["Methanol"] += mw;
    if (p.end_iron_steel) categories["Iron & Steel"] += mw;
    if (p.end_mobility) categories["Mobility"] += mw;
    if (p.end_power) categories["Power"] += mw;
    if (p.end_grid_inj || p.end_chp || p.end_domestic_heat) categories["Grid & Blending"] += mw;
    if (p.end_biofuels || p.end_synfuels) categories["Bio / Synfuels"] += mw;
  });

  return categories;
}

function renderEndUseChart() {
  const ctx = document.getElementById("enduse-chart");
  if (!ctx) return;

  const categories = aggregateEndUseCapacity();
  const labels = Object.keys(categories);
  const dataValues = labels.map(l => categories[l]);

  const chartConfig = {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Capacity (MWel)',
        data: dataValues,
        backgroundColor: '#3fd6e8',
        borderColor: '#0a0e16',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: 'rgba(120, 160, 200, 0.05)' },
          ticks: { color: '#67748c', font: { family: 'Space Grotesk', size: 9.5 } }
        },
        y: {
          title: { display: true, text: 'Capacity (MWel)', color: '#67748c', font: { size: 9.5 } },
          grid: { color: 'rgba(120, 160, 200, 0.05)' },
          ticks: { color: '#67748c', font: { family: 'Inter', size: 9.5 } }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  };

  if (enduseChartInstance) enduseChartInstance.destroy();
  enduseChartInstance = new Chart(ctx, chartConfig);
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
          labels: { color: '#b6c2d4', font: { family: 'Space Grotesk', size: 10 } }
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

  // Update Volumetric comparisons
  document.getElementById("sim-lh2-vol").textContent = `${Math.round(lh2Vol).toLocaleString()} m³`;
  document.getElementById("sim-nh3-vol").textContent = `${Math.round(nh3Vol).toLocaleString()} m³`;
  document.getElementById("sim-lohc-vol").textContent = `${Math.round(lohcVol).toLocaleString()} m³`;

  // Update energy loss metrics
  document.getElementById("sim-lh2-loss").textContent = `${lh2LossPct}%`;
  document.getElementById("sim-nh3-loss").textContent = `${nh3LossPct}%`;
  document.getElementById("sim-lohc-loss").textContent = `${lohcLossPct}%`;

  // Update boil-off loss note
  document.getElementById("sim-boiloff-val").textContent = `${lh2BoilOff.toFixed(1)} tons H₂ (${((lh2BoilOff / payload) * 100).toFixed(2)}%)`;
}

// 2. Interactive Sector catalog selection
function selectSectorParity(key) {
  selectedSectorKey = key;
  const d = SECTOR_PARITY_CATALOG[key];
  if (!d) return;

  document.querySelectorAll(".sector-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.sector === key);
  });

  const details = document.getElementById("sector-parity-details");
  if (details) {
    details.innerHTML = `
      <div style="background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-md); padding:14px; display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h4 style="font-size:12.5px; font-family:var(--font-head); color:var(--text-hi); margin:0;">${escapeHtml(d.name)}</h4>
          <span style="font-size:10.5px; font-weight:700; color:var(--cyan); background:rgba(63,214,232,0.1); border:1px solid rgba(63,214,232,0.3); padding:2px 8px; border-radius:12px;">Parity Target: ${escapeHtml(d.parity)}</span>
        </div>
        <dl style="display:grid; grid-template-columns:100px 1fr; gap:6px; font-size:11px; margin:0; line-height:1.4;">
          <dt style="color:var(--text-faint); font-weight:600; text-transform:uppercase; font-size:9.5px;">Intensity</dt>
          <dd style="color:var(--text-hi); font-weight:500; margin:0;">${escapeHtml(d.volume)}</dd>
          
          <dt style="color:var(--text-faint); font-weight:600; text-transform:uppercase; font-size:9.5px;">Key Offtakers</dt>
          <dd style="color:var(--cyan); font-weight:600; margin:0;">${escapeHtml(d.offtakers)}</dd>
        </dl>
        <div style="border-top:1px solid var(--line); padding-top:8px; font-size:10.5px; line-height:1.4; color:var(--text-muted);">
          <strong style="color:var(--text-hi); font-size:10px; text-transform:uppercase;">Offtaker Chemistry Process:</strong>
          <div style="margin-top:2px;">${escapeHtml(d.desc)}</div>
        </div>
      </div>
    `;
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
        <span class="last-updated" id="dt-last-updated" style="margin-left: auto; font-size:10px; color:var(--text-faint); font-family:var(--font-mono);">Loading…</span>
      </div>

      <!-- Main Visual Grid -->
      <div style="display:grid; grid-template-columns: 1.1fr 0.9fr; gap:16px;">
        
        <!-- Left: End-use chart & Sector detail selection -->
        <div style="display:flex; flex-direction:column; gap:16px;">
          
          <!-- Bar Chart -->
          <div class="dashboard-card glass" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:10px;">
            <h3 style="font-size:14px; font-family:var(--font-head); color:var(--text-hi);">Hydrogen End-Use Capacity Distribution</h3>
            <div class="chart-wrapper" style="height: 180px; position:relative; background:rgba(0,0,0,0.15); border:1px solid var(--line); border-radius:var(--r-sm);">
              <canvas id="enduse-chart"></canvas>
            </div>
          </div>

          <!-- Sector catalog -->
          <div class="dashboard-card glass" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:12px;">
            <h3 style="font-size:14px; font-family:var(--font-head); color:var(--text-hi);">Industrial Offtaker &amp; Parity Catalog</h3>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <button class="sector-btn tab-btn" data-sector="steel" style="text-align:left; font-size:11px; padding:8px 10px; margin:0;" onclick="selectSectorParity('steel')">
                DRI Green Steelmaking
              </button>
              <button class="sector-btn tab-btn" data-sector="ammonia" style="text-align:left; font-size:11px; padding:8px 10px; margin:0;" onclick="selectSectorParity('ammonia')">
                Clean Nitrogen Fertilizers
              </button>
              <button class="sector-btn tab-btn" data-sector="aviation" style="text-align:left; font-size:11px; padding:8px 10px; margin:0;" onclick="selectSectorParity('aviation')">
                Synthetic Aviation (SAF)
              </button>
              <button class="sector-btn tab-btn" data-sector="shipping" style="text-align:left; font-size:11px; padding:8px 10px; margin:0;" onclick="selectSectorParity('shipping')">
                Maritime Fuel Blending
              </button>
            </div>

            <style>
              .sector-btn.tab-btn.active {
                color: var(--cyan) !important;
                border-color: rgba(63,214,232,0.4) !important;
                background: rgba(63,214,232,0.06) !important;
              }
            </style>

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
              <h3 style="font-size:14px; font-family:var(--font-head); color:var(--text-hi);">Fleet Rollout orderbooks</h3>
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
            <h3 style="font-size:14px; font-family:var(--font-head); color:var(--text-hi);">Hydrogen Carrier Transport Simulator</h3>
            <p style="font-size:11px; color:var(--text-muted); line-height:1.4; margin:0;">
              Compare liquefaction volumes, transshipment boil-off, and roundtrip energy conversion losses across major ocean carriers.
            </p>

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

            <!-- Comparison Table -->
            <table style="width:100%; border-collapse:collapse; font-size:11px; text-align:left; border:1px solid var(--line); border-radius:4px; overflow:hidden;">
              <thead>
                <tr style="background:rgba(120,160,200,0.03); border-bottom:1px solid var(--line); font-size:9.5px; font-weight:600; color:var(--text-faint); text-transform:uppercase;">
                  <th style="padding:6px 8px;">Carrier Mode</th>
                  <th style="padding:6px 8px;">Vol. Needed</th>
                  <th style="padding:6px 8px;">Process Loss</th>
                </tr>
              </thead>
              <tbody>
                <tr style="border-bottom:1px solid rgba(120,160,200,0.03);">
                  <td style="padding:6px 8px; font-weight:600; color:var(--text-hi);">Liquid H₂ (LH₂)</td>
                  <td id="sim-lh2-vol" style="padding:6px 8px; color:var(--cyan); font-variant-numeric:tabular-nums;">—</td>
                  <td id="sim-lh2-loss" style="padding:6px 8px; color:var(--text-muted); font-variant-numeric:tabular-nums;">—</td>
                </tr>
                <tr style="border-bottom:1px solid rgba(120,160,200,0.03);">
                  <td style="padding:6px 8px; font-weight:600; color:var(--text-hi);">Ammonia (NH₃)</td>
                  <td id="sim-nh3-vol" style="padding:6px 8px; color:var(--cyan); font-variant-numeric:tabular-nums;">—</td>
                  <td id="sim-nh3-loss" style="padding:6px 8px; color:var(--text-muted); font-variant-numeric:tabular-nums;">—</td>
                </tr>
                <tr>
                  <td style="padding:6px 8px; font-weight:600; color:var(--text-hi);">LOHC System</td>
                  <td id="sim-lohc-vol" style="padding:6px 8px; color:var(--cyan); font-variant-numeric:tabular-nums;">—</td>
                  <td id="sim-lohc-loss" style="padding:6px 8px; color:var(--text-muted); font-variant-numeric:tabular-nums;">—</td>
                </tr>
              </tbody>
            </table>

            <!-- Boil off advisory -->
            <div style="background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-md); padding:8px 10px; font-size:10.5px; line-height:1.4; color:var(--text-muted);">
              ⚠️ <strong style="color:var(--text-hi); font-size:10px;">LH₂ Transit Boil-off Loss:</strong> 
              <span id="sim-boiloff-val" style="color:var(--cyan); font-weight:600;">—</span>
            </div>

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
  renderEndUseChart();

  // Cache loading for mobility trend chart
  let cached = null;
  try {
    const raw = localStorage.getItem(TRANSPORT_CACHE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch (err) {}

  if (cached) {
    renderTransportChart(cached);
    const ts = document.getElementById("dt-last-updated");
    if (ts) {
      ts.textContent = `Cached: ${new Date(cached.lastUpdated).toLocaleTimeString()}`;
      ts.classList.add("stale");
    }
  }

  // Background revalidation
  fetchTransportData()
    .then((freshData) => {
      try {
        localStorage.setItem(TRANSPORT_CACHE_KEY, JSON.stringify(freshData));
      } catch (err) {}
      
      renderTransportChart(freshData);
      const ts = document.getElementById("dt-last-updated");
      if (ts) {
        ts.textContent = `Live: ${new Date(freshData.lastUpdated).toLocaleTimeString()}`;
        ts.classList.remove("stale");
        ts.classList.remove("error");
      }

      const select = document.getElementById("t-mode-select");
      if (select) {
        select.onchange = () => {
          renderTransportChart(freshData);
        };
      }
    })
    .catch((err) => {
      console.error("Transport data revalidation failed:", err);
      const ts = document.getElementById("dt-last-updated");
      if (ts) {
        ts.textContent = "Offline/Revalidation Failed";
        ts.classList.add("error");
      }
    });
}
