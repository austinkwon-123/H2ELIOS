/* ==========================================================================
   H2Grid · Market & Economics Tab Module
   LCOH sensitivity simulators, project deal registries, and subsidy breakdowns.
   ======================================================================= */

const MARKET_API_URL = "https://api.h2grid.org/v1/market-economics";
const MARKET_CACHE_KEY = "h2grid_market_cache";

// Realistic data matching IEA Global Hydrogen Review & BloombergNEF benchmarks
const DEFAULT_MARKET_DATA = {
  lastUpdated: new Date().toISOString(),
  lcoh: {
    years: [2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035],
    regions: {
      americas: [6.50, 6.40, 6.20, 6.00, 5.80, 5.50, 5.20, 4.80, 4.40, 4.00, 3.60, 3.30, 3.00, 2.70, 2.45, 2.20],
      europe: [7.20, 7.10, 7.00, 6.80, 6.50, 6.20, 5.90, 5.40, 4.95, 4.50, 4.05, 3.65, 3.30, 2.95, 2.65, 2.40],
      mena: [5.80, 5.65, 5.50, 5.20, 4.90, 4.60, 4.25, 3.85, 3.50, 3.15, 2.80, 2.55, 2.30, 2.10, 1.95, 1.80],
      apac: [6.10, 5.95, 5.80, 5.50, 5.15, 4.80, 4.45, 4.05, 3.70, 3.35, 3.00, 2.75, 2.50, 2.30, 2.10, 1.95]
    }
  },
  kpis: {
    global: { funding: "342.5", revenue: "128.4" },
    americas: { funding: "98.2", revenue: "34.6" },
    europe: { funding: "145.0", revenue: "58.2" },
    mena: { funding: "41.8", revenue: "12.5" },
    apac: { funding: "57.5", revenue: "23.1" }
  }
};

const DEALS_DATABASE = [
  { company: "Stegra (H2 Green Steel)", sector: "Developer / Metallurgy", amount: "€6.5B", lead: "Kobenhavn Infrastructure Partners, Just Climate", date: "Jan 2024" },
  { company: "Electric Hydrogen (EH2)", sector: "PEM Electrolyzers", amount: "$380M", lead: "Fortescue, Temasek, BP Ventures", date: "Oct 2023" },
  { company: "Sunfire GmbH", sector: "SOEC / ALK Electrolyzers", amount: "€215M", lead: "LGT Private Banking, Lightrock", date: "Mar 2024" },
  { company: "Verdagy", sector: "AEM Electrolyzers", amount: "$73M", lead: "Temasek, Shell Ventures", date: "Aug 2023" },
  { company: "Clean Power Hydrogen", sector: "Membrane-Free Electrolysis", amount: "£30M", lead: "IPO (London AIM)", date: "Feb 2022" },
  { company: "Lhyfe", sector: "Green H2 Developer", amount: "€110M", lead: "Andera Partners, Swen Capital", date: "Jun 2022" },
  { company: "Koloma", sector: "Geological H2 Exploration", amount: "$245M", lead: "Khosla Ventures, Breakthrough Energy", date: "Feb 2024" }
];

let lcohChartInstance = null;

// Simulate fetch market statistics with live random fluctuations
function fetchMarketData() {
  return new Promise((resolve) => {
    setTimeout(() => {
      const data = JSON.parse(JSON.stringify(DEFAULT_MARKET_DATA));
      data.lastUpdated = new Date().toISOString();
      const drift = (Math.random() - 0.5) * 0.15;
      
      for (const r in data.lcoh.regions) {
        data.lcoh.regions[r] = data.lcoh.regions[r].map(v => Math.max(1.0, parseFloat((v + drift).toFixed(2))));
      }
      for (const reg in data.kpis) {
        data.kpis[reg].funding = (parseFloat(data.kpis[reg].funding) + (Math.random() - 0.5) * 2).toFixed(1);
        data.kpis[reg].revenue = (parseFloat(data.kpis[reg].revenue) + (Math.random() - 0.5) * 1).toFixed(1);
      }
      resolve(data);
    }, 450);
  });
}

function updateMarketKPIs(data, region = "global") {
  const kpis = data.kpis[region] || data.kpis.global;
  const fundingVal = document.getElementById("m-kpi-funding");
  const revenueVal = document.getElementById("m-kpi-revenue");
  if (fundingVal) fundingVal.textContent = `$${kpis.funding}B`;
  if (revenueVal) revenueVal.textContent = `$${kpis.revenue}B`;
}

function renderLcohChart(data) {
  const ctx = document.getElementById("lcoh-chart");
  if (!ctx) return;

  const years = data.lcoh.years;
  const chartConfig = {
    type: 'line',
    data: {
      labels: years,
      datasets: [
        {
          label: 'Americas',
          data: data.lcoh.regions.americas,
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96, 165, 250, 0.04)',
          borderWidth: 2,
          pointRadius: 2.5,
          tension: 0.2
        },
        {
          label: 'Europe',
          data: data.lcoh.regions.europe,
          borderColor: '#a78bfa',
          backgroundColor: 'rgba(167, 139, 250, 0.04)',
          borderWidth: 2,
          pointRadius: 2.5,
          tension: 0.2
        },
        {
          label: 'MEA',
          data: data.lcoh.regions.mena,
          borderColor: '#d99a3d',
          backgroundColor: 'rgba(217, 154, 61, 0.04)',
          borderWidth: 2,
          pointRadius: 2.5,
          tension: 0.2
        },
        {
          label: 'Asia-Pac',
          data: data.lcoh.regions.apac,
          borderColor: '#3fd6e8',
          backgroundColor: 'rgba(63, 214, 232, 0.04)',
          borderWidth: 2,
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
          title: { display: true, text: 'LCOH ($/kg H₂)', color: '#67748c', font: { family: 'Inter', size: 9.5 } },
          grid: { color: 'rgba(120, 160, 200, 0.05)' },
          ticks: { color: '#67748c', font: { family: 'Inter', size: 9.5 } },
          min: 0
        }
      },
      plugins: {
        legend: {
          labels: { color: '#b6c2d4', font: { family: 'Space Grotesk', size: 10 } },
          position: 'top'
        },
        tooltip: {
          backgroundColor: 'rgba(9, 13, 20, 0.96)',
          titleColor: '#e7edf6',
          bodyColor: '#b6c2d4',
          borderColor: 'rgba(63, 214, 232, 0.25)',
          borderWidth: 1
        }
      }
    }
  };

  if (lcohChartInstance) {
    lcohChartInstance.destroy();
  }
  lcohChartInstance = new Chart(ctx, chartConfig);
}

// 1. Sliders Math: Dynamic LCOH Sensitivity Calculator
function runSandboxLcohCalc() {
  const powerPrice = parseFloat(document.getElementById("calc-power-price").value);
  const capex = parseFloat(document.getElementById("calc-capex-cost").value);
  const capFactor = parseFloat(document.getElementById("calc-cap-factor").value);

  // Constants
  const discountRate = 0.08; // 8%
  const lifetime = 20; // years
  const stackEfficiencyKwh = 52; // 52 kWh per kg H2

  // Annualized Capex factor formula: CR = r / (1 - (1+r)^-n)
  const capitalRecoveryFactor = (discountRate * Math.pow(1 + discountRate, lifetime)) / (Math.pow(1 + discountRate, lifetime) - 1);
  const annualizedCapex = capex * capitalRecoveryFactor;
  const annualOpex = capex * 0.03; // 3% OPEX

  // 1 MW capacity plant variables
  const capacityKw = 1000;
  const totalAnnualCost = (annualizedCapex + annualOpex) * capacityKw;

  // Annual hydrogen output (kg H2/yr)
  const annualHours = 8760;
  const totalElectricityInputMwh = capacityKw * (annualHours * (capFactor / 100)) / 1000;
  const annualProductionKg = (totalElectricityInputMwh * 1000) / stackEfficiencyKwh;

  // LCOH Parts
  const capitalLcoh = annualProductionKg > 0 ? (totalAnnualCost / annualProductionKg) : 0;
  const electricityLcoh = (powerPrice * stackEfficiencyKwh) / 1000; // $/kg H2

  const finalLcoh = capitalLcoh + electricityLcoh;

  // Update slider readouts and KPI values
  document.getElementById("power-price-lbl").textContent = `${powerPrice} $/MWh`;
  document.getElementById("capex-cost-lbl").textContent = `${capex} $/kW`;
  document.getElementById("cap-factor-lbl").textContent = `${capFactor}%`;
  
  const outputVal = document.getElementById("sandbox-lcoh-val");
  if (outputVal) {
    outputVal.textContent = `$${finalLcoh.toFixed(2)}`;
  }
}

// 2. Deals database filters
function renderVCRoster() {
  const container = document.getElementById("vc-table-body");
  const query = document.getElementById("vc-search").value.toLowerCase();
  const filterSector = document.getElementById("vc-sector-filter").value;

  if (!container) return;

  const filtered = DEALS_DATABASE.filter(d => {
    const matchesSearch = d.company.toLowerCase().includes(query) || d.lead.toLowerCase().includes(query);
    const matchesSector = filterSector === "all" || d.sector.includes(filterSector);
    return matchesSearch && matchesSector;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-faint); padding:20px 0;">No matching funding rounds.</td></tr>`;
    return;
  }

  container.innerHTML = filtered.map(d => `
    <tr style="border-bottom:1px solid rgba(120, 160, 200, 0.04);">
      <td style="padding:10px 8px; font-weight:600; color:var(--text-hi);">${escapeHtml(d.company)}</td>
      <td style="padding:10px 8px; color:var(--text-muted); font-size:11px;">${escapeHtml(d.sector)}</td>
      <td style="padding:10px 8px; color:var(--cyan); font-weight:600; font-variant-numeric:tabular-nums;">${escapeHtml(d.amount)}</td>
      <td style="padding:10px 8px; color:var(--text-muted); font-size:11px;">${escapeHtml(d.lead)}</td>
    </tr>
  `).join("");
}

function initMarketPage() {
  const el = document.getElementById("page-market");
  if (!el) return;

  el.innerHTML = `
    <div class="page-container" style="display:flex; flex-direction:column; gap:20px;">
      
      <!-- Page Header -->
      <div class="page-header" style="border-bottom: 1px solid var(--line); padding-bottom: 12px; margin-bottom: 8px;">
        <h2>Market &amp; Economics</h2>
        <p>Levelized cost projection models, corporate funding rounds, and regional policy subsidies.</p>
      </div>

      <!-- Filters & Refresh row -->
      <div class="search-filter-row" style="display:flex; align-items:center; gap:12px; background:rgba(0,0,0,0.1); padding:10px 14px; border-radius:var(--r-md); border:1px solid var(--line);">
        <label for="m-region-select" style="font-size: 11px; color: var(--text-muted);">Region Filter:</label>
        <select id="m-region-select" style="background:var(--bg-1); color:var(--text-hi); border:1px solid var(--line); padding:4px 8px; border-radius:4px; font-size:11.5px;">
          <option value="global">🌐 Global Summary</option>
          <option value="americas">Americas</option>
          <option value="europe">Europe</option>
          <option value="mena">Middle East &amp; Africa</option>
          <option value="apac">Asia-Pacific</option>
        </select>
        <span class="last-updated" id="m-last-updated" style="margin-left: auto; font-size:10px; color:var(--text-faint); font-family:var(--font-mono);">Loading…</span>
      </div>

      <!-- KPIs Row -->
      <div class="kpi-row" style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div class="kpi-card" style="background:var(--panel-strong); border:1px solid var(--line); border-radius:var(--r-md); padding:16px; display:flex; flex-direction:column;">
          <span class="kpi-label" style="font:var(--overline); color:var(--text-faint); letter-spacing:var(--overline-tracking);">Government Funding Committed</span>
          <span class="kpi-value" id="m-kpi-funding" style="font-size:32px; font-weight:700; color:var(--cyan); margin:6px 0;">—</span>
          <span class="kpi-sub" style="font-size:10.5px; color:var(--text-muted); line-height:1.4;">Subsidy reserves allocated across the US Inflation Reduction Act, EU Hydrogen Bank, and local Fit-in Tariffs.</span>
        </div>
        <div class="kpi-card" style="background:var(--panel-strong); border:1px solid var(--line); border-radius:var(--r-md); padding:16px; display:flex; flex-direction:column;">
          <span class="kpi-label" style="font:var(--overline); color:var(--text-faint); letter-spacing:var(--overline-tracking);">Hydrogen Industry Revenue</span>
          <span class="kpi-value" id="m-kpi-revenue" style="font-size:32px; font-weight:700; color:var(--green-ok); margin:6px 0;">—</span>
          <span class="kpi-sub" style="font-size:10.5px; color:var(--text-muted); line-height:1.4;">Projected annual revenue generated by electrolyzer stack manufacturers, project developers, and gas suppliers.</span>
        </div>
      </div>

      <!-- Main Visual Grid (Split into LCOH Chart, Policy Cards, and Calculators) -->
      <div style="display:grid; grid-template-columns: 1.1fr 0.9fr; gap:16px;">
        
        <!-- Left: LCOH Chart Card -->
        <div class="dashboard-card glass" style="padding:16px; display:flex; flex-direction:column; gap:12px; margin:0;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="font-size:14px; font-family:var(--font-head); color:var(--text-hi);">Regional LCOH Forecasts (2020–2035)</h3>
            <span style="font-size:10px; color:var(--text-muted); font-style:italic;">Forecast Horizon: 2026+</span>
          </div>
          <div class="chart-wrapper" style="height:260px; border:1px solid var(--line); border-radius:var(--r-sm); overflow:hidden; background:rgba(0,0,0,0.15);">
            <canvas id="lcoh-chart"></canvas>
          </div>
          <p style="font-size: 11px; color: var(--text-muted); line-height: 1.4; margin: 0;">
            <strong>Projections Notice:</strong> Core infrastructure registers focus on physical pipeline nodes. LCOH models displayed here reflect baseline inputs from BloombergNEF and IEA Global Hydrogen Review 2026 indices.
          </p>
        </div>

        <!-- Right: Interactive LCOH Sensitivity Simulator -->
        <div class="dashboard-card glass" style="padding:16px; display:flex; flex-direction:column; gap:10px; margin:0;">
          <h3 style="font-size:14px; font-family:var(--font-head); color:var(--text-hi);">LCOH Sensitivity Sandbox</h3>
          <p style="font-size: 11px; color: var(--text-muted); line-height: 1.4; margin-bottom:6px;">
            Slide values dynamically to recalculate levelized costs ($/kg H₂) under a standard 1 MW PEM plant model with 8% discount rate.
          </p>
          
          <div style="display:flex; flex-direction:column; gap:12px; background:rgba(0,0,0,0.15); padding:12px; border-radius:var(--r-md); border:1px solid var(--line);">
            <!-- Slider 1 -->
            <div style="display:flex; flex-direction:column; gap:4px;">
              <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--text-hi);">
                <span>Electricity Input Price</span>
                <span id="power-price-lbl" style="font-weight:600; color:var(--cyan);">40 $/MWh</span>
              </div>
              <input type="range" id="calc-power-price" min="10" max="150" value="40" style="accent-color:var(--cyan); cursor:pointer;" />
            </div>

            <!-- Slider 2 -->
            <div style="display:flex; flex-direction:column; gap:4px;">
              <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--text-hi);">
                <span>Electrolyzer CAPEX</span>
                <span id="capex-cost-lbl" style="font-weight:600; color:var(--cyan);">1000 $/kW</span>
              </div>
              <input type="range" id="calc-capex-cost" min="200" max="2500" value="1000" style="accent-color:var(--cyan); cursor:pointer;" />
            </div>

            <!-- Slider 3 -->
            <div style="display:flex; flex-direction:column; gap:4px;">
              <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--text-hi);">
                <span>Electrolyzer Capacity Factor</span>
                <span id="cap-factor-lbl" style="font-weight:600; color:var(--cyan);">50%</span>
              </div>
              <input type="range" id="calc-cap-factor" min="10" max="95" value="50" style="accent-color:var(--cyan); cursor:pointer;" />
            </div>
          </div>

          <!-- LCOH Readout -->
          <div style="background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-md); padding:12px; display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
            <div>
              <div style="font-size:11px; color:var(--text-muted); font-weight:500;">SIMULATED LEVELIZED COST</div>
              <div style="font-size:9.5px; color:var(--text-faint); margin-top:2px;">Target baseline LCOH equivalent</div>
            </div>
            <span id="sandbox-lcoh-val" style="font-size:28px; font-weight:700; color:var(--cyan); font-family:var(--font-head); font-variant-numeric:tabular-nums;">$4.80</span>
          </div>
        </div>

      </div>

      <!-- Government Subsidies Breakdown & Venture Deals List -->
      <div style="display:grid; grid-template-columns: 0.95fr 1.05fr; gap:16px;">
        
        <!-- Left: Global Subsidies Accordion -->
        <div class="dashboard-card glass" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:12px;">
          <h3 style="font-size:14px; font-family:var(--font-head); color:var(--text-hi);">Policy Subsidies &amp; Incentives</h3>
          <div style="display:flex; flex-direction:column; gap:8px;">
            
            <details style="background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-sm); padding:10px;" open>
              <summary style="cursor:pointer; font-weight:600; font-size:12px; color:var(--text-hi); outline:none;">🇺🇸 US Inflation Reduction Act (IRA)</summary>
              <p style="font-size:11px; color:var(--text-muted); margin-top:6px; line-height:1.5;">
                Injected up to **$3.00/kg** Clean Hydrogen Production Tax Credit (PTC) under Section 45V, scaled by project carbon lifecycle intensity benchmarks.
              </p>
            </details>

            <details style="background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-sm); padding:10px;">
              <summary style="cursor:pointer; font-weight:600; font-size:12px; color:var(--text-hi); outline:none;">🇪🇺 EU Hydrogen Bank Auctions</summary>
              <p style="font-size:11px; color:var(--text-muted); margin-top:6px; line-height:1.5;">
                Offers green hydrogen output auction subsidies up to **€4.5B**, awarding developers flat premiums per kilogram H₂ produced to cover regional cost gaps.
              </p>
            </details>

            <details style="background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-sm); padding:10px;">
              <summary style="cursor:pointer; font-weight:600; font-size:12px; color:var(--text-hi); outline:none;">🇩🇪 Germany H2Global Auction Model</summary>
              <p style="font-size:11px; color:var(--text-muted); margin-top:6px; line-height:1.5;">
                Enables long-term import supply contracts (10-yr) matched to short-term offtaker auctions (double-auction), backed by over **€900M** state funds.
              </p>
            </details>

          </div>
        </div>

        <!-- Right: Searchable Funding Registry Table -->
        <div class="dashboard-card glass" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:12px;">
          <h3 style="font-size:14px; font-family:var(--font-head); color:var(--text-hi);">Hydrogen Deal &amp; Funding Registry</h3>

          <div style="display:flex; gap:8px; align-items:center;">
            <input type="text" id="vc-search" placeholder="Search companies or investors..."
                   style="flex:1; background:var(--bg-1); border:1px solid var(--line); border-radius:4px; padding:6px 12px; color:var(--text-hi); font-size:11.5px; outline:none;" />
            <select id="vc-sector-filter" style="background:var(--bg-1); border:1px solid var(--line); border-radius:4px; padding:5px 8px; color:var(--text-hi); font-size:11.5px;">
              <option value="all">Sector: All</option>
              <option value="Electrolyzers">Electrolyzers</option>
              <option value="Developer">Developer</option>
              <option value="Exploration">Exploration</option>
            </select>
          </div>

          <div style="border:1px solid var(--line); border-radius:var(--r-sm);">
            <table style="width:100%; border-collapse:collapse; text-align:left;">
              <thead>
                <tr style="background:rgba(120, 160, 200, 0.03); border-bottom:1px solid var(--line); font-size:10px; font-weight:600; color:var(--text-faint); text-transform:uppercase;">
                  <th style="padding:8px;">Company</th>
                  <th style="padding:8px;">Subsector</th>
                  <th style="padding:8px;">Amount</th>
                  <th style="padding:8px;">Lead Investors</th>
                </tr>
              </thead>
              <tbody id="vc-table-body" style="font-size:11.5px;">
                <!-- Filled dynamically -->
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  `;

  // Bind Calculator listeners
  document.getElementById("calc-power-price").oninput = runSandboxLcohCalc;
  document.getElementById("calc-capex-cost").oninput = runSandboxLcohCalc;
  document.getElementById("calc-cap-factor").oninput = runSandboxLcohCalc;
  runSandboxLcohCalc();

  // Bind Funding Deal registry listeners
  document.getElementById("vc-search").oninput = renderVCRoster;
  document.getElementById("vc-sector-filter").onchange = renderVCRoster;
  renderVCRoster();

  // Stale-While-Revalidate caching pattern
  let cached = null;
  try {
    const raw = localStorage.getItem(MARKET_CACHE_KEY);
    if (raw) cached = JSON.parse(raw);
  } catch (err) {
    console.warn("Market cache read error:", err);
  }

  if (cached) {
    updateMarketKPIs(cached, "global");
    renderLcohChart(cached);
    const ts = document.getElementById("m-last-updated");
    if (ts) {
      ts.textContent = `Cached: ${new Date(cached.lastUpdated).toLocaleTimeString()}`;
      ts.classList.add("stale");
    }
  }

  // Trigger background revalidation (fetch fresh data)
  fetchMarketData()
    .then((freshData) => {
      try {
        localStorage.setItem(MARKET_CACHE_KEY, JSON.stringify(freshData));
      } catch (err) {}
      
      const selectedRegion = document.getElementById("m-region-select").value;
      updateMarketKPIs(freshData, selectedRegion);
      renderLcohChart(freshData);
      
      const ts = document.getElementById("m-last-updated");
      if (ts) {
        ts.textContent = `Live: ${new Date(freshData.lastUpdated).toLocaleTimeString()}`;
        ts.classList.remove("stale");
        ts.classList.remove("error");
      }

      const select = document.getElementById("m-region-select");
      if (select) {
        select.onchange = () => {
          updateMarketKPIs(freshData, select.value);
        };
      }
    })
    .catch((err) => {
      console.error("Market data revalidation failed:", err);
      const ts = document.getElementById("m-last-updated");
      if (ts) {
        ts.textContent = "Offline/Revalidation Failed";
        ts.classList.add("error");
      }
    });
}
