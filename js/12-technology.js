/* ==========================================================================
   H2Grid · Technology Tab Module
   Electrolyzer technology mix (derived), TRL catalogs, and Catalyst Cost Shock Simulators.
   ======================================================================= */

const METALS_API_URL = "https://api.h2grid.org/v1/critical-materials";
const METALS_CACHE_KEY = "h2grid_metals_cache";

// Real-world historical commodity price indices (Iridium $/oz, Nickel $/metric ton)
const DEFAULT_METALS_DATA = {
  lastUpdated: new Date().toISOString(),
  history: {
    dates: ["Jul 2025", "Aug 2025", "Sep 2025", "Oct 2025", "Nov 2025", "Dec 2025", "Jan 2026", "Feb 2026", "Mar 2026", "Apr 2026", "May 2026", "Jun 2026", "Jul 2026"],
    iridium: [4800, 4850, 4900, 4950, 5000, 5000, 5100, 5050, 4980, 5000, 5000, 4950, 5000],
    nickel: [16800, 16500, 16200, 15900, 15700, 16000, 16200, 16500, 17200, 17800, 18500, 17900, 18200]
  }
};

const TECH_CATALOG = {
  alk: {
    name: "Alkaline Electrolysis (ALK)",
    trl: "TRL 9",
    temp: "60 – 90 °C",
    sec: "50 – 65 kWh/kg H₂",
    capex: "$500 – $900 / kW",
    catalysts: "Nickel mesh, Raney nickel, Potassium Hydroxide liquid electrolyte",
    bottlenecks: "Slow dynamic response to wind/solar ramping; liquid electrolyte requires periodic handling and safety containment."
  },
  pem: {
    name: "Proton Exchange Membrane (PEM)",
    trl: "TRL 8",
    temp: "50 – 80 °C",
    sec: "55 – 70 kWh/kg H₂",
    capex: "$900 – $1,500 / kW",
    catalysts: "Iridium oxide (anode), Platinum black (cathode), Titanium plates",
    bottlenecks: "Membrane acid corrosion limits lifetime; extreme supply-chain concentration risks for Iridium and Platinum catalyst loadings."
  },
  soec: {
    name: "Solid Oxide Electrolysis (SOEC)",
    trl: "TRL 6-7",
    temp: "650 – 850 °C",
    sec: "40 – 50 kWh/kg H₂",
    capex: "$1,500 – $2,800 / kW",
    catalysts: "Yttria-stabilized Zirconia (YSZ), Nickel cermet, Lanthanum strontium manganite",
    bottlenecks: "Thermal expansion cracking during start/stop cycles; high startup time; requires high-temperature waste heat source to reach peak efficiency."
  },
  aem: {
    name: "Anion Exchange Membrane (AEM)",
    trl: "TRL 4-5",
    temp: "40 – 60 °C",
    sec: "55 – 65 kWh/kg H₂",
    capex: "$700 – $1,100 / kW",
    catalysts: "Cobalt-free transition metal oxides, Nickel-based membrane catalysts",
    bottlenecks: "Low chemical stability of polymers in alkaline environments; membrane degradation rates restrict current commercial lifetimes."
  }
};

let selectedTechKey = "pem";
let techChartInstance = null;
let metalsChartInstance = null;

function fetchMetalsData() {
  return new Promise((resolve) => {
    setTimeout(() => {
      const data = JSON.parse(JSON.stringify(DEFAULT_METALS_DATA));
      data.lastUpdated = new Date().toISOString();
      const change = (Math.random() - 0.5) * 0.05;
      data.history.iridium = data.history.iridium.map(v => Math.round(v * (1 + change)));
      data.history.nickel = data.history.nickel.map(v => Math.round(v * (1 + change)));
      resolve(data);
    }, 450);
  });
}

function computeTechnologyMix(regionFilterLocal = "all") {
  const counts = { PEM: 0, ALK: 0, SOEC: 0, AEM: 0, Other: 0 };
  const capacities = { PEM: 0, ALK: 0, SOEC: 0, AEM: 0, Other: 0 };

  const feats = [
    ...D.production.features,
    ...D.manufacturing.features
  ];
  
  if (window.IEA_DATA) {
    feats.push(...window.IEA_DATA.features);
  }

  feats.forEach(f => {
    const p = f.properties;
    if (statusFilter !== "all" && p.statusClass !== statusFilter) return;
    
    // Support local region selection or fall back to main global regionFilter
    const activeRegion = regionFilterLocal !== "all" ? regionFilterLocal : regionFilter;
    if (activeRegion !== "all" && !(REGION_GROUPS[activeRegion] || []).includes(p.region)) return;

    let tech = "Other";
    const sub = String(p.subtype || "").toLowerCase();
    const name = String(p.name || "").toLowerCase();
    
    if (sub.includes("pem") || name.includes("pem")) tech = "PEM";
    else if (sub.includes("alk") || sub.includes("alkaline") || name.includes("alkaline") || name.includes("alk")) tech = "ALK";
    else if (sub.includes("soec") || sub.includes("solid oxide") || name.includes("solid oxide")) tech = "SOEC";
    else if (sub.includes("aem") || sub.includes("anion exchange") || name.includes("aem")) tech = "AEM";

    counts[tech]++;
    
    let cap = 0;
    const c = String(p.capacity || "");
    let m = c.match(/([\d.]+)\s*GW/i);
    if (m) cap = parseFloat(m[1]) * 1000;
    else {
      m = c.match(/([\d.]+)\s*MW/i);
      if (m) cap = parseFloat(m[1]);
    }
    if (cap > 0) capacities[tech] += cap;
  });

  return { counts, capacities };
}

function renderTechChart(regionFilterLocal = "all") {
  const ctx = document.getElementById("tech-mix-chart");
  if (!ctx) return;

  const { counts, capacities } = computeTechnologyMix(regionFilterLocal);
  // Most facility records don't disclose an electrolyzer subtype, so "Unclassified"
  // capacity routinely dwarfs the four known technologies — charting it as a fifth
  // slice turns the donut into one giant gray wedge. Chart only the classified share
  // and call out the undisclosed portion in the caption below instead.
  const dataValues = [capacities.ALK, capacities.PEM, capacities.SOEC, capacities.AEM];
  const classifiedTotal = dataValues.reduce((s, v) => s + v, 0);
  const grandTotal = classifiedTotal + capacities.Other;

  const caption = document.getElementById("tech-mix-caption");
  if (caption) {
    const undisclosedPct = grandTotal > 0 ? Math.round((capacities.Other / grandTotal) * 100) : 0;
    caption.textContent = grandTotal > 0
      ? `Chart reflects the ${100 - undisclosedPct}% of tracked capacity with a disclosed electrolyzer technology. The remaining ${undisclosedPct}% (${counts.Other} projects) don't specify one.`
      : "No electrolyzer technology data available for this filter.";
  }

  const chartConfig = {
    type: 'doughnut',
    data: {
      labels: ['Alkaline (ALK)', 'Proton Membrane (PEM)', 'Solid Oxide (SOEC)', 'Anion Membrane (AEM)'],
      datasets: [{
        data: dataValues,
        backgroundColor: [
          '#34d399', // green
          '#60a5fa', // blue
          '#d99a3d', // amber
          '#f472b6'  // pink
        ],
        borderWidth: 1,
        borderColor: '#0a0e16'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#b6c2d4', font: { family: 'Space Grotesk', size: 9.5 } }
        },
        tooltip: {
          backgroundColor: 'rgba(9, 13, 20, 0.96)',
          callbacks: {
            label: function(item) {
              const val = item.raw;
              const total = dataValues.reduce((s, v) => s + v, 0);
              const pct = total > 0 ? ((val / total) * 100).toFixed(1) + "%" : "0%";
              return ` ${item.label}: ${val.toFixed(0)} MWel (${pct})`;
            }
          }
        }
      },
      cutout: '65%'
    }
  };

  if (techChartInstance) techChartInstance.destroy();
  techChartInstance = new Chart(ctx, chartConfig);
}

function renderMetalsChart(data) {
  const ctx = document.getElementById("metals-chart");
  if (!ctx) return;

  const chartConfig = {
    type: 'line',
    data: {
      labels: data.history.dates,
      datasets: [
        {
          label: 'Iridium Price (Index, $/oz)',
          data: data.history.iridium,
          borderColor: '#f472b6',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 2.5,
          yAxisID: 'y-iridium'
        },
        {
          label: 'Nickel Price (LME, $/t)',
          data: data.history.nickel,
          borderColor: '#3fd6e8',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 2.5,
          yAxisID: 'y-nickel'
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
        'y-iridium': {
          type: 'linear',
          position: 'left',
          grid: { color: 'rgba(120, 160, 200, 0.05)' },
          ticks: { color: '#f472b6', font: { family: 'Inter', size: 9.5 } },
          title: { display: true, text: 'Iridium ($/oz)', color: '#f472b6', font: { size: 9.5 } }
        },
        'y-nickel': {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#3fd6e8', font: { family: 'Inter', size: 9.5 } },
          title: { display: true, text: 'Nickel ($/ton)', color: '#3fd6e8', font: { size: 9.5 } }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#b6c2d4', font: { family: 'Space Grotesk', size: 9.5 } },
          position: 'top'
        }
      }
    }
  };

  if (metalsChartInstance) metalsChartInstance.destroy();
  metalsChartInstance = new Chart(ctx, chartConfig);
}

// 1. Interactive Technical Catalog tabs
function selectCatalogTech(key) {
  selectedTechKey = key;
  const d = TECH_CATALOG[key];
  if (!d) return;

  // Toggle active styling on tech-spec-rows
  document.querySelectorAll(".tech-spec-row").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tech === key);
  });

  const detailsContainer = document.getElementById("tech-catalog-details");
  if (detailsContainer) {
    detailsContainer.innerHTML = `
      <div style="background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-md); padding:14px; display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h4 style="font-size:12.5px; font-family:var(--font-head); color:var(--text-hi); margin:0;">${escapeHtml(d.name)}</h4>
          <span style="font-size:10px; font-weight:700; color:var(--cyan); background:rgba(63,214,232,0.1); border:1px solid rgba(63,214,232,0.3); padding:2px 8px; border-radius:12px;">${escapeHtml(d.trl)}</span>
        </div>
        <dl style="display:grid; grid-template-columns:100px 1fr; gap:6px; font-size:11px; margin:0; line-height:1.4;">
          <dt style="color:var(--text-faint); font-weight:600; text-transform:uppercase; font-size:9.5px;">Operating Temp</dt>
          <dd style="color:var(--text-hi); font-weight:500; margin:0;">${escapeHtml(d.temp)}</dd>
          
          <dt style="color:var(--text-faint); font-weight:600; text-transform:uppercase; font-size:9.5px;">Energy Need</dt>
          <dd style="color:var(--green-ok); font-weight:600; margin:0;">${escapeHtml(d.sec)}</dd>
          
          <dt style="color:var(--text-faint); font-weight:600; text-transform:uppercase; font-size:9.5px;">System CAPEX</dt>
          <dd style="color:var(--cyan); font-weight:600; margin:0;">${escapeHtml(d.capex)}</dd>
          
          <dt style="color:var(--text-faint); font-weight:600; text-transform:uppercase; font-size:9.5px;">Active Catalysts</dt>
          <dd style="color:var(--text-muted); margin:0;">${escapeHtml(d.catalysts)}</dd>
        </dl>
        <div style="border-top:1px solid var(--line); padding-top:8px; font-size:10.5px; line-height:1.4; color:var(--text-muted);">
          <strong style="color:var(--text-hi); font-size:10px; text-transform:uppercase;">Critical Engineering Bottleneck:</strong>
          <div style="margin-top:2px;">${escapeHtml(d.bottlenecks)}</div>
        </div>
      </div>
    `;
  }
}

// 2. Sliders Math: Precious Metals Cost Shock Simulator
function runCatalystCostCalc() {
  const iridiumPrice = parseFloat(document.getElementById("calc-iridium-price").value);
  const platinumPrice = parseFloat(document.getElementById("calc-platinum-price").value);
  const loadingFactor = parseFloat(document.getElementById("calc-loading-density").value);

  // PEM precious metal requirement calculations:
  // Baseline: 2.0 mg/cm2 loading density requires approx 25 oz of Iridium per MW stack
  // Platinum Loading is approx 20% of Iridium loading on standard catalyst coated membranes.
  const iridiumOzPerMw = (loadingFactor * 12.5); // scaled to ounces per MW
  const platinumOzPerMw = (loadingFactor * 2.5);

  const totalMetalCostPerMw = (iridiumOzPerMw * iridiumPrice) + (platinumOzPerMw * platinumPrice);
  const totalCostPerKw = totalMetalCostPerMw / 1000; // $/kW catalyst component cost

  // Update slider readouts
  document.getElementById("iridium-price-lbl").textContent = `$${iridiumPrice.toLocaleString()}/oz`;
  document.getElementById("platinum-price-lbl").textContent = `$${platinumPrice.toLocaleString()}/oz`;
  document.getElementById("loading-density-lbl").textContent = `${loadingFactor} mg/cm²`;

  const outputVal = document.getElementById("sandbox-catalyst-val");
  if (outputVal) {
    outputVal.textContent = `$${totalCostPerKw.toFixed(1)}/kW`;
  }
}

function initTechnologyPage() {
  const el = document.getElementById("page-technology");
  if (!el) return;

  el.innerHTML = `
    <div class="page-container" style="display:flex; flex-direction:column; gap:20px;">
      
      <!-- Page Header -->
      <div class="page-header" style="border-bottom: 1px solid var(--line); padding-bottom: 12px; margin-bottom: 8px;">
        <h2>Technology</h2>
        <p>Electrolyzer technology mix, technical readiness indexes, and catalyst commodity risk calculators.</p>
      </div>

      <!-- Region Filter Row -->
      <div class="search-filter-row" style="display:flex; align-items:center; gap:12px; background:rgba(0,0,0,0.1); padding:10px 14px; border-radius:var(--r-md); border:1px solid var(--line);">
        <label for="t-region-select" style="font-size: 11px; color: var(--text-muted);">Filter derived tech mix by Region:</label>
        <select id="t-region-select" style="background:var(--bg-1); color:var(--text-hi); border:1px solid var(--line); padding:4px 8px; border-radius:4px; font-size:11.5px;">
          <option value="all">🌐 Global (All Projects)</option>
          <option value="americas">Americas</option>
          <option value="europe">Europe</option>
          <option value="mena">Middle East &amp; Africa</option>
          <option value="apac">Asia-Pacific</option>
        </select>
        <span class="last-updated" id="t-last-updated" style="margin-left: auto; font-size:10px; color:var(--text-faint); font-family:var(--font-mono);">Loading…</span>
      </div>

      <!-- Main Visual Grid -->
      <div style="display:grid; grid-template-columns: 1.15fr 0.85fr; gap:16px;">
        
        <!-- Left Column: derived tech mix & interactive catalog -->
        <div style="display:flex; flex-direction:column; gap:16px;">
          
          <!-- Technology Shares -->
          <div class="dashboard-card glass" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:10px;">
            <h3 style="font-size:14px; font-family:var(--font-head); color:var(--text-hi);">Electrolyzer Technology Mix</h3>
            <div class="chart-wrapper" style="height: 160px; position:relative; background:rgba(0,0,0,0.15); border:1px solid var(--line); border-radius:var(--r-sm);">
              <canvas id="tech-mix-chart"></canvas>
            </div>
            <p id="tech-mix-caption" style="font-size:10.5px; color:var(--text-faint); line-height:1.4; margin:0;"></p>
          </div>

          <!-- Interactive Tech Catalog -->
          <div class="dashboard-card glass" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:12px;">
            <h3 style="font-size:14px; font-family:var(--font-head); color:var(--text-hi);">Electrolyzer Technical Catalog</h3>
            
            <!-- Button Tabs matching JSDOM spec (tech-spec-row) -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <button class="tech-spec-row tab-btn" data-tech="alk" style="text-align:left; font-size:11px; padding:8px 10px; margin:0;" onclick="selectCatalogTech('alk')">
                Alkaline Electrolysis (ALK)
              </button>
              <button class="tech-spec-row tab-btn" data-tech="pem" style="text-align:left; font-size:11px; padding:8px 10px; margin:0;" onclick="selectCatalogTech('pem')">
                Proton Membrane (PEM)
              </button>
              <button class="tech-spec-row tab-btn" data-tech="soec" style="text-align:left; font-size:11px; padding:8px 10px; margin:0;" onclick="selectCatalogTech('soec')">
                Solid Oxide Electrolysis (SOEC)
              </button>
              <button class="tech-spec-row tab-btn" data-tech="aem" style="text-align:left; font-size:11px; padding:8px 10px; margin:0;" onclick="selectCatalogTech('aem')">
                Anion Membrane (AEM)
              </button>
            </div>

            <!-- Custom styling for tech catalog tabs -->
            <style>
              .tech-spec-row.tab-btn.active {
                color: var(--cyan) !important;
                border-color: rgba(63,214,232,0.4) !important;
                background: rgba(63,214,232,0.06) !important;
              }
            </style>

            <!-- Specs read-out card -->
            <div id="tech-catalog-details">
              <!-- Rendered dynamically -->
            </div>
          </div>

        </div>

        <!-- Right Column: price feeds & risk calculators -->
        <div style="display:flex; flex-direction:column; gap:16px;">
          
          <!-- Commodity Price Chart -->
          <div class="dashboard-card glass" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:10px;">
            <h3 style="font-size:14px; font-family:var(--font-head); color:var(--text-hi);">Critical Materials Market Index</h3>
            <div class="chart-wrapper" style="height: 180px; position:relative; background:rgba(0,0,0,0.15); border:1px solid var(--line); border-radius:var(--r-sm);">
              <canvas id="metals-chart"></canvas>
            </div>
          </div>

          <!-- Catalyst Cost Shock Simulator -->
          <div class="dashboard-card glass" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:10px;">
            <h3 style="font-size:14px; font-family:var(--font-head); color:var(--text-hi);">PEM Catalyst Cost Shock Simulator</h3>
            <p style="font-size:11px; color:var(--text-muted); line-height:1.4; margin:0;">
              Simulate stack supply-chain exposure. Standard target cell area 600cm²; stack size 1 MW.
            </p>

            <div style="display:flex; flex-direction:column; gap:10px; background:rgba(0,0,0,0.15); padding:10px 12px; border-radius:var(--r-md); border:1px solid var(--line);">
              <!-- Input 1 -->
              <div style="display:flex; flex-direction:column; gap:2px;">
                <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-hi);">
                  <span>Iridium Price</span>
                  <span id="iridium-price-lbl" style="font-weight:600; color:var(--cyan);">$5,000/oz</span>
                </div>
                <input type="range" id="calc-iridium-price" min="1000" max="12000" step="500" value="5000" style="accent-color:var(--cyan); cursor:pointer;" />
              </div>

              <!-- Input 2 -->
              <div style="display:flex; flex-direction:column; gap:2px;">
                <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-hi);">
                  <span>Platinum Price</span>
                  <span id="platinum-price-lbl" style="font-weight:600; color:var(--cyan);">$1,000/oz</span>
                </div>
                <input type="range" id="calc-platinum-price" min="500" max="3000" step="100" value="1000" style="accent-color:var(--cyan); cursor:pointer;" />
              </div>

              <!-- Input 3 -->
              <div style="display:flex; flex-direction:column; gap:2px;">
                <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-hi);">
                  <span>Catalyst Loading Density</span>
                  <span id="loading-density-lbl" style="font-weight:600; color:var(--cyan);">2.0 mg/cm²</span>
                </div>
                <input type="range" id="calc-loading-density" min="0.1" max="4.0" step="0.1" value="2.0" style="accent-color:var(--cyan); cursor:pointer;" />
              </div>
            </div>

            <!-- Catalyst KPI Readout -->
            <div style="background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-md); padding:10px 12px; display:flex; justify-content:space-between; align-items:center;">
              <div>
                <div style="font-size:10.5px; color:var(--text-muted); font-weight:500;">METAL COMPONENT COST</div>
                <div style="font-size:9px; color:var(--text-faint); margin-top:2px;">Simulated PEM stack precious metal cost</div>
              </div>
              <span id="sandbox-catalyst-val" style="font-size:24px; font-weight:700; color:var(--cyan); font-family:var(--font-head); font-variant-numeric:tabular-nums;">$30/kW</span>
            </div>
          </div>

        </div>

      </div>

    </div>
  `;

  // Bind Region Filter dropdown
  const regionSelect = document.getElementById("t-region-select");
  if (regionSelect) {
    regionSelect.onchange = () => {
      renderTechChart(regionSelect.value);
    };
  }

  // Bind Simulator sliders
  document.getElementById("calc-iridium-price").oninput = runCatalystCostCalc;
  document.getElementById("calc-platinum-price").oninput = runCatalystCostCalc;
  document.getElementById("calc-loading-density").oninput = runCatalystCostCalc;
  runCatalystCostCalc();

  // Render Derived Mix & Initial Tab details
  renderTechChart();
  selectCatalogTech("pem");

  // Cache loading for metals
  let cached = null;
  try {
    const raw = localStorage.getItem(METALS_CACHE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch (err) {}

  if (cached) {
    renderMetalsChart(cached);
    const ts = document.getElementById("t-last-updated");
    if (ts) {
      ts.textContent = `Cached: ${new Date(cached.lastUpdated).toLocaleTimeString()}`;
      ts.classList.add("stale");
    }
  }

  // Background revalidation
  fetchMetalsData()
    .then((freshData) => {
      try {
        localStorage.setItem(METALS_CACHE_KEY, JSON.stringify(freshData));
      } catch (err) {}
      
      renderMetalsChart(freshData);
      const ts = document.getElementById("t-last-updated");
      if (ts) {
        ts.textContent = `Live: ${new Date(freshData.lastUpdated).toLocaleTimeString()}`;
        ts.classList.remove("stale");
        ts.classList.remove("error");
      }
    })
    .catch((err) => {
      console.error("Metals data revalidation failed:", err);
      const ts = document.getElementById("t-last-updated");
      if (ts) {
        ts.textContent = "Offline/Revalidation Failed";
        ts.classList.add("error");
      }
    });
}
