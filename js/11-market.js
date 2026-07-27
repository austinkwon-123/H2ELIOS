/* ==========================================================================
   H2Grid · Market & Economics Tab Module
   Real break-even hydrogen price trends (IPCEI Clean Hydrogen Observatory,
   js/breakeven-data.js), an LCOH sensitivity sandbox, policy subsidy
   reference cards, and a curated funding/deal registry.
   Funding/revenue KPIs and the deal registry are hand-curated reference
   figures, not live data - clearly marked SAMPLE rather than presented as
   real-time, per the project's data-honesty convention.
   ======================================================================= */

// ---- Curated reference data (SAMPLE - not live) ---------------------------------------------
const MARKET_SAMPLE_KPIS = {
  funding: "342.5",  // $B - govt subsidy reserves committed globally (IRA 45V, EU Hydrogen Bank, national schemes)
  revenue: "128.4"   // $B - projected annual industry revenue (electrolyzer OEMs, developers, gas suppliers)
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

// ---- Real break-even price chart (js/breakeven-data.js) -------------------------------------
const BREAKEVEN_SECTORS = [
  { key: "refining", label: "Oil Refining" },
  { key: "hdtrucks", label: "Heavy-Duty Trucks" },
  { key: "maritime", label: "Maritime" }
];
const MARKET_CHART_COLORS = ["#3fd6e8", "#a78bfa", "#fbbf24", "#4ade80", "#f87171", "#60a5fa"];
const MAX_CHART_LINES = 6;

let selectedSector = "refining";
let selectedKeys = [];

function latestValue(values) {
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null) return values[i];
  }
  return null;
}

function sectorSeries(sector) {
  const data = window.BREAKEVEN_DATA;
  if (!data || !data.sectors[sector]) return [];
  return data.sectors[sector].series;
}

function defaultSelection(sector) {
  const series = sectorSeries(sector).filter((s) => latestValue(s.values) != null);
  if (!series.length) return [];
  const sorted = [...series].sort((a, b) => latestValue(a.values) - latestValue(b.values));
  const picks = new Set([sorted[0].key, sorted[sorted.length - 1].key]);
  if (sorted.length > 2) picks.add(sorted[Math.floor(sorted.length / 2)].key);
  return Array.from(picks);
}

function renderBreakevenRanking() {
  const el = document.getElementById("breakeven-ranking");
  if (!el) return;
  const series = sectorSeries(selectedSector)
    .filter((s) => latestValue(s.values) != null)
    .sort((a, b) => latestValue(a.values) - latestValue(b.values));
  const max = Math.max(...series.map((s) => latestValue(s.values)));

  el.innerHTML = series.map((s) => {
    const v = latestValue(s.values);
    const pct = Math.round((v / max) * 100);
    const idx = selectedKeys.indexOf(s.key);
    const active = idx !== -1;
    const dotColor = active ? MARKET_CHART_COLORS[idx % MARKET_CHART_COLORS.length] : "var(--text-faint)";
    return `<div class="bar-row breakeven-row${active ? " active" : ""}" data-key="${escapeAttr(s.key)}" role="button" tabindex="0">
      <span class="bar-label" style="display:flex;align-items:center;gap:6px;">
        <span style="width:7px;height:7px;border-radius:50%;background:${dotColor};flex-shrink:0;"></span>
        ${escapeHtml(s.key)}
      </span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct}%;background:${dotColor};color:${dotColor}"></span></span>
      <span class="bar-count">${v.toFixed(2)}</span>
    </div>`;
  }).join("");

  el.querySelectorAll(".breakeven-row").forEach((row) => {
    row.addEventListener("click", () => toggleBreakevenKey(row.dataset.key));
    row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleBreakevenKey(row.dataset.key); } });
  });
}

function toggleBreakevenKey(key) {
  const idx = selectedKeys.indexOf(key);
  if (idx !== -1) {
    selectedKeys.splice(idx, 1);
  } else {
    if (selectedKeys.length >= MAX_CHART_LINES) selectedKeys.shift();
    selectedKeys.push(key);
  }
  renderBreakevenChart();
  renderBreakevenRanking();
}

function renderBreakevenChart() {
  const el = document.getElementById("lcoh-chart");
  if (!el) return;
  const data = window.BREAKEVEN_DATA;
  if (!data) { el.innerHTML = `<div class="chart-empty">Break-even price data unavailable.</div>`; return; }

  const years = data.years;
  const series = sectorSeries(selectedSector);
  const lines = selectedKeys
    .map((key) => series.find((s) => s.key === key))
    .filter(Boolean);

  const W = 620, H = 260, padL = 42, padR = 16, padT = 16, padB = 28;
  const plotW = W - padL - padR, plotH = H - padT - padB;

  const allVals = lines.flatMap((s) => s.values).filter((v) => v != null);
  const vMin = allVals.length ? Math.min(0, Math.min(...allVals)) : 0;
  const vMax = allVals.length ? Math.max(...allVals) * 1.12 : 5;

  const xAt = (i) => padL + (i / (years.length - 1)) * plotW;
  const yAt = (v) => padT + plotH - ((v - vMin) / (vMax - vMin || 1)) * plotH;

  if (!lines.length) {
    el.innerHTML = `<div class="chart-empty">Select a country or application below to plot its break-even price trend.</div>`;
    return;
  }

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const y = padT + plotH * (1 - t);
    const v = vMin + (vMax - vMin) * t;
    return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="rgba(120,160,200,0.08)" stroke-width="1"/>
      <text x="${padL - 8}" y="${y + 3}" text-anchor="end" font-size="9.5" fill="#67748c" font-family="Inter">${v.toFixed(1)}</text>`;
  }).join("");

  const xLabels = years.map((y, i) => `<text x="${xAt(i)}" y="${H - 8}" text-anchor="middle" font-size="9.5" fill="#67748c" font-family="Inter">${y}</text>`).join("");

  const polylines = lines.map((s, i) => {
    const color = MARKET_CHART_COLORS[i % MARKET_CHART_COLORS.length];
    const pts = s.values.map((v, vi) => (v == null ? null : `${xAt(vi)},${yAt(v)}`)).filter(Boolean).join(" ");
    const dots = s.values.map((v, vi) => v == null ? "" : `<circle class="bk-dot" style="animation-delay:${0.15 + vi * 0.12}s" cx="${xAt(vi)}" cy="${yAt(v)}" r="3" fill="${color}"><title>${escapeHtml(s.key)} · ${years[vi]}: €${v.toFixed(2)}/kg</title></circle>`).join("");
    const lastIdx = s.values.map((v, vi) => v != null ? vi : -1).filter((vi) => vi !== -1).pop();
    const label = lastIdx != null ? `<text class="bk-label" x="${xAt(lastIdx) + 6}" y="${yAt(s.values[lastIdx]) + 3}" font-size="9.5" font-family="Inter" font-weight="600" fill="${color}">${escapeHtml(s.key.length > 18 ? s.key.slice(0, 16) + "…" : s.key)}</text>` : "";
    return `<polyline class="bk-line" points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>${dots}${label}`;
  }).join("");

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="breakeven-svg" role="img" aria-label="Break-even hydrogen price trend, ${escapeAttr(BREAKEVEN_SECTORS.find(s => s.key === selectedSector).label)}">
    ${gridLines}${xLabels}${polylines}
  </svg>`;

  animateChartDrawIn(el);
}

// Stroke-dasharray/dashoffset draw-in: measure each line's real path length
// then animate dashoffset -> 0 (CSS transition on .bk-line handles the
// easing). Runs on every redraw, not just first paint, so switching sector
// or toggling a country back on always gets the small "drawing" payoff.
function animateChartDrawIn(container) {
  const lines = container.querySelectorAll("polyline.bk-line");
  lines.forEach((line) => {
    // getTotalLength() isn't implemented in every SVG environment (notably
    // jsdom, used by js/smoke-test.js) - skip the animation there rather
    // than let an unsupported-method error abort the rest of init.
    if (typeof line.getTotalLength !== "function") return;
    let length;
    try { length = line.getTotalLength(); } catch (err) { return; }
    line.style.transition = "none";
    line.style.strokeDasharray = String(length);
    line.style.strokeDashoffset = String(length);
    line.getBoundingClientRect(); // force reflow so the "none" transition + starting offset commit before re-enabling
    line.style.transition = "";
    requestAnimationFrame(() => { line.style.strokeDashoffset = "0"; });
  });
}

// Count-up readout, easeOutCubic. Runs once per tab visit (initMarketPage
// only ever fires once - see 09-router.js's loadedRoutes guard).
function animateCountUp(el, target, { duration = 900, prefix = "", suffix = "" } = {}) {
  if (!el) return;
  const t0 = performance.now();
  function step(now) {
    const t = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = `${prefix}${(target * eased).toFixed(1)}${suffix}`;
    if (t < 1) requestAnimationFrame(step);
    else el.textContent = `${prefix}${target.toFixed(1)}${suffix}`;
  }
  requestAnimationFrame(step);
}

function wireBreakevenControls() {
  const nav = document.getElementById("breakeven-sector-nav");
  if (!nav) return;
  nav.querySelectorAll(".sector-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedSector = btn.dataset.sector;
      nav.querySelectorAll(".sector-tab").forEach((b) => b.classList.toggle("active", b === btn));
      selectedKeys = defaultSelection(selectedSector);
      renderBreakevenChart();
      renderBreakevenRanking();
    });
  });
}

// ---- LCOH Sensitivity Sandbox (real formula, user-driven inputs - not fabricated data) -------
function runSandboxLcohCalc() {
  const powerPrice = parseFloat(document.getElementById("calc-power-price").value);
  const capex = parseFloat(document.getElementById("calc-capex-cost").value);
  const capFactor = parseFloat(document.getElementById("calc-cap-factor").value);

  const discountRate = 0.08;
  const lifetime = 20;
  const stackEfficiencyKwh = 52;

  const capitalRecoveryFactor = (discountRate * Math.pow(1 + discountRate, lifetime)) / (Math.pow(1 + discountRate, lifetime) - 1);
  const annualizedCapex = capex * capitalRecoveryFactor;
  const annualOpex = capex * 0.03;

  const capacityKw = 1000;
  const totalAnnualCost = (annualizedCapex + annualOpex) * capacityKw;

  const annualHours = 8760;
  const totalElectricityInputMwh = capacityKw * (annualHours * (capFactor / 100)) / 1000;
  const annualProductionKg = (totalElectricityInputMwh * 1000) / stackEfficiencyKwh;

  const capitalLcoh = annualProductionKg > 0 ? (totalAnnualCost / annualProductionKg) : 0;
  const electricityLcoh = (powerPrice * stackEfficiencyKwh) / 1000;

  const finalLcoh = capitalLcoh + electricityLcoh;

  document.getElementById("power-price-lbl").textContent = `${powerPrice} $/MWh`;
  document.getElementById("capex-cost-lbl").textContent = `${capex} $/kW`;
  document.getElementById("cap-factor-lbl").textContent = `${capFactor}%`;

  const outputVal = document.getElementById("sandbox-lcoh-val");
  if (outputVal) outputVal.textContent = `$${finalLcoh.toFixed(2)}`;
}

// ---- Deal & funding registry (curated, static) -----------------------------------------------
function renderVCRoster() {
  const container = document.getElementById("vc-table-body");
  const query = document.getElementById("vc-search").value.toLowerCase();
  const filterSector = document.getElementById("vc-sector-filter").value;
  if (!container) return;

  const filtered = DEALS_DATABASE.filter((d) => {
    const matchesSearch = d.company.toLowerCase().includes(query) || d.lead.toLowerCase().includes(query);
    const matchesSector = filterSector === "all" || d.sector.includes(filterSector);
    return matchesSearch && matchesSector;
  });

  if (!filtered.length) {
    container.innerHTML = `<div class="news-empty">No matching funding rounds.</div>`;
    return;
  }

  container.innerHTML = filtered.map((d) => `
    <div class="deal-card">
      <div class="deal-card-top">
        <span class="deal-company">${escapeHtml(d.company)}</span>
        <span class="deal-amount">${escapeHtml(d.amount)}</span>
      </div>
      <div class="deal-sector">${escapeHtml(d.sector)}</div>
      <div class="deal-lead">${escapeHtml(d.lead)}</div>
      <div class="deal-date">${escapeHtml(d.date)}</div>
    </div>
  `).join("");
}

// ---- Page shell -------------------------------------------------------------------------------
function initMarketPage() {
  const el = document.getElementById("page-market");
  if (!el) return;

  const sectorTabsHtml = BREAKEVEN_SECTORS.map((s, i) =>
    `<button class="sector-tab${i === 0 ? " active" : ""}" data-sector="${s.key}">${s.label}</button>`
  ).join("");

  el.innerHTML = `
    <div class="page-container">
      <div class="page-header">
        <h2>Market &amp; Economics</h2>
        <p>Real break-even hydrogen price benchmarks, a levelized-cost sensitivity model, and reference funding/policy data.</p>
      </div>

      <div class="kpi-row">
        <div class="kpi-card">
          <span class="kpi-label">Government Funding Committed <span class="badge badge-sample">SAMPLE</span></span>
          <span class="kpi-value" id="m-kpi-funding">$0.0B</span>
          <span class="kpi-sub">Illustrative subsidy reserves across the US IRA, EU Hydrogen Bank, and national schemes — not a live feed.</span>
        </div>
        <div class="kpi-card">
          <span class="kpi-label">Hydrogen Industry Revenue <span class="badge badge-sample">SAMPLE</span></span>
          <span class="kpi-value" id="m-kpi-revenue">$0.0B</span>
          <span class="kpi-sub">Illustrative annual revenue across electrolyzer OEMs, developers, and gas suppliers — not a live feed.</span>
        </div>
      </div>

      <div class="dashboard-grid two-cols">
        <div class="dashboard-card">
          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <h3>Break-Even Hydrogen Price (2022–2025)</h3>
            <span class="pill fallback">Real data · IPCEI Clean Hydrogen Observatory</span>
          </div>
          <div class="sector-tabs" id="breakeven-sector-nav">${sectorTabsHtml}</div>
          <div class="chart-wrapper" id="lcoh-chart"></div>
          <p class="chart-note">EUR/kg H₂. Click a row below to add or remove it from the chart (up to ${MAX_CHART_LINES} at once).</p>
          <div class="bar-list" id="breakeven-ranking"></div>
        </div>

        <div class="dashboard-card">
          <h3>LCOH Sensitivity Sandbox</h3>
          <p class="chart-note">Slide values to recalculate levelized cost ($/kg H₂) for a standard 1 MW PEM plant, 8% discount rate, 20-year life.</p>

          <div class="sandbox-sliders">
            <div class="sandbox-slider-row">
              <div class="sandbox-slider-head"><span>Electricity Input Price</span><span id="power-price-lbl" class="sandbox-slider-val">40 $/MWh</span></div>
              <input type="range" id="calc-power-price" min="10" max="150" value="40" />
            </div>
            <div class="sandbox-slider-row">
              <div class="sandbox-slider-head"><span>Electrolyzer CAPEX</span><span id="capex-cost-lbl" class="sandbox-slider-val">1000 $/kW</span></div>
              <input type="range" id="calc-capex-cost" min="200" max="2500" value="1000" />
            </div>
            <div class="sandbox-slider-row">
              <div class="sandbox-slider-head"><span>Electrolyzer Capacity Factor</span><span id="cap-factor-lbl" class="sandbox-slider-val">50%</span></div>
              <input type="range" id="calc-cap-factor" min="10" max="95" value="50" />
            </div>
          </div>

          <div class="sandbox-readout">
            <div>
              <div class="sandbox-readout-label">Simulated Levelized Cost</div>
              <div class="sandbox-readout-sub">Target baseline LCOH equivalent</div>
            </div>
            <span id="sandbox-lcoh-val" class="sandbox-readout-val">$4.80</span>
          </div>
        </div>
      </div>

      <div class="dashboard-grid two-cols">
        <div class="dashboard-card">
          <h3>Policy Subsidies &amp; Incentives</h3>
          <div class="subsidy-list">
            <details class="subsidy-item" open>
              <summary>🇺🇸 US Inflation Reduction Act (IRA)</summary>
              <p>Up to <strong>$3.00/kg</strong> Clean Hydrogen Production Tax Credit (Section 45V), scaled by project carbon lifecycle intensity.</p>
            </details>
            <details class="subsidy-item">
              <summary>🇪🇺 EU Hydrogen Bank Auctions</summary>
              <p>Green hydrogen output auction subsidies up to <strong>€4.5B</strong>, awarding flat per-kilogram premiums to cover regional cost gaps.</p>
            </details>
            <details class="subsidy-item">
              <summary>🇩🇪 Germany H2Global Auction Model</summary>
              <p>Long-term import supply contracts (10-yr) matched to short-term offtaker auctions (double-auction), backed by over <strong>€900M</strong> in state funds.</p>
            </details>
          </div>
        </div>

        <div class="dashboard-card">
          <h3>Hydrogen Deal &amp; Funding Registry <span class="badge badge-sample">SAMPLE</span></h3>
          <div class="deal-filters">
            <input type="text" id="vc-search" placeholder="Search companies or investors…" />
            <select id="vc-sector-filter">
              <option value="all">Sector: All</option>
              <option value="Electrolyzers">Electrolyzers</option>
              <option value="Developer">Developer</option>
              <option value="Exploration">Exploration</option>
            </select>
          </div>
          <div class="deal-list" id="vc-table-body"></div>
        </div>
      </div>
    </div>
  `;

  selectedKeys = defaultSelection(selectedSector);
  wireBreakevenControls();
  renderBreakevenChart();
  renderBreakevenRanking();

  document.getElementById("calc-power-price").oninput = runSandboxLcohCalc;
  document.getElementById("calc-capex-cost").oninput = runSandboxLcohCalc;
  document.getElementById("calc-cap-factor").oninput = runSandboxLcohCalc;
  runSandboxLcohCalc();

  document.getElementById("vc-search").oninput = renderVCRoster;
  document.getElementById("vc-sector-filter").onchange = renderVCRoster;
  renderVCRoster();

  // Entrance motion + KPI count-up: this function only ever runs once per
  // page load (09-router.js's loadedRoutes guard), so a one-time "waking
  // up" animation here never repeats/annoys on later tab switches.
  el.querySelectorAll(".kpi-card, .dashboard-card").forEach((card, i) => {
    card.classList.add("market-animate-in");
    card.style.animationDelay = `${i * 70}ms`;
  });
  animateCountUp(document.getElementById("m-kpi-funding"), parseFloat(MARKET_SAMPLE_KPIS.funding), { prefix: "$", suffix: "B" });
  animateCountUp(document.getElementById("m-kpi-revenue"), parseFloat(MARKET_SAMPLE_KPIS.revenue), { prefix: "$", suffix: "B" });
}
