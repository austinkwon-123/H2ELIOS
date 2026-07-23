/* ==========================================================================
   H2Grid · Hydrogen calculator (Tools tab)
   Five independent, live-recomputing calculators: unit conversion,
   efficiency, CAPEX/OPEX, LCOH, current density. Rendered lazily by the
   router's initToolsPage() hook (see js/09-router.js) on first visit to
   the Tools tab — this file defines that global function.
   Bounded technical parameters (efficiency, capacity, current density, etc.)
   are pure sliders with a live value readout, no adjacent number box —
   open-ended costs/prices stay plain number fields. Mirrors the "sandbox"
   sliders already used in the Market and Technology tabs.
   Browser classic scripts share one global lexical scope, so helpers from
   core are visible here. Load order doesn't matter relative to
   09-router.js: DOMContentLoaded (when the router first runs) always
   fires after every synchronous <script> tag has executed.
   ======================================================================= */

function calcFmt(n, decimals) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
}

function calcFmtInt(n) {
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString();
}

// Binds a bounded slider to a live label (e.g. "55.0 kWh/kg") and re-runs computeFn on every move.
function wireSlider(id, labelId, unit, decimals, computeFn) {
  const el = document.getElementById(id);
  const label = document.getElementById(labelId);
  if (!el) return;
  const update = () => {
    if (label) label.textContent = `${calcFmt(parseFloat(el.value), decimals)} ${unit}`;
    computeFn();
  };
  el.addEventListener("input", update);
  update();
}

// Positions a marker + fill on a fixed-range reference gauge (e.g. "where does this fall in the typical band").
function updateGauge(trackId, value, min, max) {
  const track = document.getElementById(trackId);
  if (!track) return;
  const fill = track.querySelector(".calc-gauge-fill");
  const marker = track.querySelector(".calc-gauge-marker");
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  if (fill) fill.style.width = `${pct}%`;
  if (marker) marker.style.left = `${pct}%`;
}

const UC_FACTORS = { kg: 1, nm3: 11.126, kwh_lhv: 33.33, kwh_hhv: 39.4, mj: 120 };
const UC_DECIMALS = { kg: 4, nm3: 2, kwh_lhv: 2, kwh_hhv: 2, mj: 1 };

function computeUnitConversion() {
  const value = parseFloat(document.getElementById("uc-value").value);
  const unit = document.getElementById("uc-unit").value;
  const baseKg = Number.isFinite(value) ? value / UC_FACTORS[unit] : NaN;
  Object.keys(UC_FACTORS).forEach((u) => {
    const out = document.getElementById(`uc-out-${u}`);
    if (out) out.textContent = calcFmt(baseKg * UC_FACTORS[u], UC_DECIMALS[u]);
  });
}

function wireUnitConversion() {
  document.getElementById("uc-value").addEventListener("input", computeUnitConversion);
  document.getElementById("uc-unit").addEventListener("change", computeUnitConversion);
  computeUnitConversion();
}

function computeEfficiency() {
  const sec = parseFloat(document.getElementById("eff-sec").value);
  const lhvEff = sec > 0 ? (33.33 / sec) * 100 : NaN;
  const hhvEff = sec > 0 ? (39.4 / sec) * 100 : NaN;
  document.getElementById("eff-out-lhv").textContent = calcFmt(lhvEff, 1);
  document.getElementById("eff-out-hhv").textContent = calcFmt(hhvEff, 1);
  const lhvGauge = document.getElementById("eff-gauge-lhv").querySelector(".calc-gauge-fill");
  const hhvGauge = document.getElementById("eff-gauge-hhv").querySelector(".calc-gauge-fill");
  if (lhvGauge) lhvGauge.style.width = `${Math.max(0, Math.min(100, lhvEff))}%`;
  if (hhvGauge) hhvGauge.style.width = `${Math.max(0, Math.min(100, hhvEff))}%`;
}

function wireEfficiency() {
  wireSlider("eff-sec", "eff-sec-val", "kWh/kg H₂", 1, computeEfficiency);
}

let capexOpexChart = null;

function computeCapexOpex() {
  const capacity = parseFloat(document.getElementById("co-capacity").value);
  const capexPerKw = parseFloat(document.getElementById("co-capex").value);
  const opexPct = parseFloat(document.getElementById("co-opex").value);
  const life = parseFloat(document.getElementById("co-life").value);
  const ratePct = parseFloat(document.getElementById("co-rate").value);

  const totalCapex = capacity * 1000 * capexPerKw;
  const r = ratePct / 100;
  let crf;
  if (life > 0 && r === 0) crf = 1 / life;
  else if (life > 0 && r > -1) crf = (r * Math.pow(1 + r, life)) / (Math.pow(1 + r, life) - 1);
  else crf = NaN;
  const annCapex = totalCapex * crf;
  const annOpex = totalCapex * (opexPct / 100);
  const totalAnn = annCapex + annOpex;

  document.getElementById("co-out-total").textContent = calcFmt(totalCapex, 2);
  document.getElementById("co-out-annCapex").textContent = calcFmt(annCapex, 2);
  document.getElementById("co-out-annOpex").textContent = calcFmt(annOpex, 2);
  document.getElementById("co-out-totalAnn").textContent = calcFmt(totalAnn, 2);

  const ctx = document.getElementById("co-split-chart");
  if (ctx && window.Chart) {
    const data = Number.isFinite(annCapex) && Number.isFinite(annOpex) ? [annCapex, annOpex] : [0, 0];
    if (capexOpexChart) {
      capexOpexChart.data.datasets[0].data = data;
      capexOpexChart.update();
    } else {
      capexOpexChart = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: ["Annualized CAPEX", "Annual OPEX"],
          datasets: [{ data, backgroundColor: ["#3fd6e8", "#a78bfa"], borderWidth: 1, borderColor: "#0a0e16" }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: "right", labels: { color: "#b6c2d4", font: { family: "Space Grotesk", size: 9.5 } } },
            tooltip: { backgroundColor: "rgba(9, 13, 20, 0.96)" }
          },
          cutout: "65%"
        }
      });
    }
  }
}

function wireCapexOpex() {
  document.getElementById("co-capex").addEventListener("input", computeCapexOpex);
  wireSlider("co-capacity", "co-capacity-val", "MW", 1, computeCapexOpex);
  wireSlider("co-opex", "co-opex-val", "%/yr", 1, computeCapexOpex);
  wireSlider("co-life", "co-life-val", "yrs", 0, computeCapexOpex);
  wireSlider("co-rate", "co-rate-val", "%", 1, computeCapexOpex);
  computeCapexOpex();
}

// Rough, clearly-labeled assumptions: ~1 kg H2 per 100 km, and ~15,000 km/yr of driving, are typical for a
// current-generation fuel-cell passenger car.
const FCEV_KM_PER_KG = 100;
const FCEV_KM_PER_YEAR = 15000;

function computeLcoh() {
  const annCost = parseFloat(document.getElementById("lc-annCost").value);
  const price = parseFloat(document.getElementById("lc-price").value);
  const sec = parseFloat(document.getElementById("lc-sec").value);
  const capacity = parseFloat(document.getElementById("lc-capacity").value);
  const cf = parseFloat(document.getElementById("lc-cf").value);

  const annProd = sec > 0 ? (capacity * 1000 * 8760 * (cf / 100)) / sec : NaN;
  const annElecCost = Number.isFinite(annProd) ? annProd * sec * price : NaN;
  const lcoh = Number.isFinite(annProd) && annProd > 0 ? (annCost + annElecCost) / annProd : NaN;

  document.getElementById("lc-out-prod").textContent = calcFmt(annProd, 0);
  document.getElementById("lc-out-elec").textContent = calcFmt(annElecCost, 0);
  document.getElementById("lc-out-lcoh").textContent = calcFmt(lcoh, 2);

  const callout = document.getElementById("lc-callout-text");
  if (callout) {
    if (Number.isFinite(annProd) && annProd > 0) {
      const kgPerCarYear = FCEV_KM_PER_YEAR / FCEV_KM_PER_KG;
      const cars = annProd / kgPerCarYear;
      callout.innerHTML = `That's enough hydrogen to fuel about <b>${calcFmtInt(cars)} fuel-cell passenger cars</b> for a full year of driving.`;
    } else {
      callout.textContent = "Enter valid plant parameters to see a real-world comparison.";
    }
  }
}

function wireLcoh() {
  document.getElementById("lc-annCost").addEventListener("input", computeLcoh);
  wireSlider("lc-price", "lc-price-val", "$/kWh", 3, computeLcoh);
  wireSlider("lc-sec", "lc-sec-val", "kWh/kg H₂", 1, computeLcoh);
  wireSlider("lc-capacity", "lc-capacity-val", "MW", 1, computeLcoh);
  wireSlider("lc-cf", "lc-cf-val", "%", 0, computeLcoh);
  computeLcoh();
}

function computeCurrentDensity() {
  const current = parseFloat(document.getElementById("cd-current").value);
  const area = parseFloat(document.getElementById("cd-area").value);
  const voltage = parseFloat(document.getElementById("cd-voltage").value);
  const cells = parseFloat(document.getElementById("cd-cells").value);

  const density = area > 0 ? current / area : NaN;
  const powerDensity = Number.isFinite(density) ? density * voltage : NaN;
  const stackPower = (cells * voltage * current) / 1000;

  document.getElementById("cd-out-density").textContent = calcFmt(density, 3);
  document.getElementById("cd-out-power").textContent = calcFmt(powerDensity, 3);
  document.getElementById("cd-out-stack").textContent = calcFmt(stackPower, 2);

  if (Number.isFinite(density)) updateGauge("cd-gauge", density, 0.2, 2.5);
}

function wireCurrentDensity() {
  wireSlider("cd-current", "cd-current-val", "A", 0, computeCurrentDensity);
  wireSlider("cd-area", "cd-area-val", "cm²", 0, computeCurrentDensity);
  wireSlider("cd-voltage", "cd-voltage-val", "V", 2, computeCurrentDensity);
  wireSlider("cd-cells", "cd-cells-val", "cells", 0, computeCurrentDensity);
  computeCurrentDensity();
}

function wireCalcNav() {
  document.querySelectorAll(".calc-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".calc-tab").forEach((b) => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".calc-panel").forEach((p) => { p.hidden = p.id !== `calc-${btn.dataset.calc}`; });
    });
  });
}

function initToolsPage() {
  const el = document.getElementById("page-tools");
  if (!el) return;
  el.innerHTML = `
    <div class="tools-shell">
      <div class="page-header">
        <h2>Hydrogen Calculator</h2>
        <p>Live engineering and cost models for electrolysis — drag a slider or type a value and every figure recalculates instantly.</p>
      </div>
      <nav class="calc-nav">
        <button class="calc-tab active" data-calc="unit">Unit Conversion</button>
        <button class="calc-tab" data-calc="efficiency">Efficiency</button>
        <button class="calc-tab" data-calc="capex">CAPEX/OPEX</button>
        <button class="calc-tab" data-calc="lcoh">LCOH</button>
        <button class="calc-tab" data-calc="density">Current Density</button>
      </nav>

      <div class="calc-panel" id="calc-unit">
        <p class="calc-desc">Convert between the ways hydrogen quantities get measured — mass, gas volume, and energy content.</p>
        <div class="calc-row">
          <label for="uc-value">Value
            <span class="calc-tip" title="The quantity you want to convert, in the unit selected below.">?</span>
          </label>
          <input type="number" id="uc-value" value="1" step="any" />
        </div>
        <div class="calc-row"><label for="uc-unit">Unit</label>
          <select id="uc-unit">
            <option value="kg">kg H₂</option>
            <option value="nm3">Nm³ H₂</option>
            <option value="kwh_lhv">kWh (LHV)</option>
            <option value="kwh_hhv">kWh (HHV)</option>
            <option value="mj">MJ (LHV)</option>
          </select>
        </div>
        <div class="calc-output"><span class="k">kg H₂</span><span class="v" id="uc-out-kg">—</span></div>
        <div class="calc-output"><span class="k">Nm³ H₂</span><span class="v" id="uc-out-nm3">—</span></div>
        <div class="calc-output"><span class="k">kWh (LHV)</span><span class="v" id="uc-out-kwh_lhv">—</span></div>
        <div class="calc-output"><span class="k">kWh (HHV)</span><span class="v" id="uc-out-kwh_hhv">—</span></div>
        <div class="calc-output"><span class="k">MJ (LHV)</span><span class="v" id="uc-out-mj">—</span></div>
      </div>

      <div class="calc-panel" id="calc-efficiency" hidden>
        <p class="calc-desc">See how much of an electrolyzer's electricity input actually ends up stored in the hydrogen it makes.</p>
        <div class="calc-slider-row">
          <div class="calc-slider-head">
            <label for="eff-sec">Specific energy consumption
              <span class="calc-tip" title="Electricity used per kilogram of hydrogen produced. Modern PEM/alkaline stacks run roughly 50–65 kWh/kg.">?</span>
            </label>
            <span class="calc-slider-val" id="eff-sec-val">—</span>
          </div>
          <input type="range" id="eff-sec" min="30" max="100" step="0.5" value="55" />
        </div>
        <div class="calc-output"><span class="k">Efficiency vs. LHV (%)</span><span class="v" id="eff-out-lhv">—</span></div>
        <div class="calc-gauge" id="eff-gauge-lhv">
          <div class="calc-gauge-track"><span class="calc-gauge-fill" style="width:0%"></span></div>
        </div>
        <div class="calc-output"><span class="k">Efficiency vs. HHV (%)</span><span class="v" id="eff-out-hhv">—</span></div>
        <div class="calc-gauge" id="eff-gauge-hhv">
          <div class="calc-gauge-track"><span class="calc-gauge-fill" style="width:0%"></span></div>
        </div>
      </div>

      <div class="calc-panel" id="calc-capex" hidden>
        <p class="calc-desc">Estimate the annualized cost of owning and running an electrolyzer plant across its lifetime.</p>
        <div class="calc-slider-row">
          <div class="calc-slider-head">
            <label for="co-capacity">Plant capacity <span class="calc-tip" title="Rated electrolyzer input power.">?</span></label>
            <span class="calc-slider-val" id="co-capacity-val">—</span>
          </div>
          <input type="range" id="co-capacity" min="0.5" max="50" step="0.5" value="10" />
        </div>
        <div class="calc-row">
          <label for="co-capex">CAPEX ($/kW)
            <span class="calc-tip" title="Installed cost per kW of electrolyzer capacity, including stack, BoP, and EPC.">?</span>
          </label>
          <input type="number" id="co-capex" value="1200" step="any" />
        </div>
        <div class="calc-slider-row">
          <div class="calc-slider-head">
            <label for="co-opex">OPEX <span class="calc-tip" title="Annual operating cost as a share of total CAPEX — maintenance, stack refresh reserve, labor.">?</span></label>
            <span class="calc-slider-val" id="co-opex-val">—</span>
          </div>
          <input type="range" id="co-opex" min="1" max="10" step="0.1" value="3" />
        </div>
        <div class="calc-slider-row">
          <div class="calc-slider-head">
            <label for="co-life">Plant lifetime <span class="calc-tip" title="Economic lifetime used to annualize the upfront CAPEX.">?</span></label>
            <span class="calc-slider-val" id="co-life-val">—</span>
          </div>
          <input type="range" id="co-life" min="5" max="30" step="1" value="20" />
        </div>
        <div class="calc-slider-row">
          <div class="calc-slider-head">
            <label for="co-rate">Discount rate <span class="calc-tip" title="Cost of capital used to spread CAPEX evenly over the plant's lifetime (capital recovery factor).">?</span></label>
            <span class="calc-slider-val" id="co-rate-val">—</span>
          </div>
          <input type="range" id="co-rate" min="2" max="15" step="0.5" value="8" />
        </div>
        <div class="calc-output"><span class="k">Total CAPEX ($)</span><span class="v" id="co-out-total">—</span></div>
        <div class="calc-output"><span class="k">Annualized CAPEX ($/yr)</span><span class="v" id="co-out-annCapex">—</span></div>
        <div class="calc-output"><span class="k">Annual OPEX ($/yr)</span><span class="v" id="co-out-annOpex">—</span></div>
        <div class="calc-output"><span class="k">Total annualized cost ($/yr)</span><span class="v" id="co-out-totalAnn">—</span></div>
        <div class="calc-donut-wrap"><canvas id="co-split-chart"></canvas></div>
      </div>

      <div class="calc-panel" id="calc-lcoh" hidden>
        <p class="calc-desc">Estimate the levelized cost of hydrogen production, and what that annual output could power in the real world.</p>
        <div class="calc-row">
          <label for="lc-annCost">Annualized CAPEX + OPEX ($/yr)
            <span class="calc-tip" title="Pull this from the CAPEX/OPEX tab's 'Total annualized cost' output, or your own project figures.">?</span>
          </label>
          <input type="number" id="lc-annCost" value="1200000" step="any" />
        </div>
        <div class="calc-slider-row">
          <div class="calc-slider-head">
            <label for="lc-price">Electricity price <span class="calc-tip" title="Delivered electricity price paid by the plant.">?</span></label>
            <span class="calc-slider-val" id="lc-price-val">—</span>
          </div>
          <input type="range" id="lc-price" min="0.01" max="0.25" step="0.005" value="0.05" />
        </div>
        <div class="calc-slider-row">
          <div class="calc-slider-head">
            <label for="lc-sec">Specific energy consumption <span class="calc-tip" title="Electricity used per kilogram of hydrogen produced.">?</span></label>
            <span class="calc-slider-val" id="lc-sec-val">—</span>
          </div>
          <input type="range" id="lc-sec" min="30" max="100" step="0.5" value="55" />
        </div>
        <div class="calc-slider-row">
          <div class="calc-slider-head">
            <label for="lc-capacity">Plant capacity <span class="calc-tip" title="Rated electrolyzer input power.">?</span></label>
            <span class="calc-slider-val" id="lc-capacity-val">—</span>
          </div>
          <input type="range" id="lc-capacity" min="0.5" max="50" step="0.5" value="10" />
        </div>
        <div class="calc-slider-row">
          <div class="calc-slider-head">
            <label for="lc-cf">Capacity factor <span class="calc-tip" title="Share of the year the plant runs at rated output — availability plus power supply.">?</span></label>
            <span class="calc-slider-val" id="lc-cf-val">—</span>
          </div>
          <input type="range" id="lc-cf" min="10" max="100" step="1" value="90" />
        </div>
        <div class="calc-output"><span class="k">Annual H₂ production (kg)</span><span class="v" id="lc-out-prod">—</span></div>
        <div class="calc-output"><span class="k">Annual electricity cost ($)</span><span class="v" id="lc-out-elec">—</span></div>
        <div class="calc-output"><span class="k">LCOH ($/kg)</span><span class="v" id="lc-out-lcoh">—</span></div>
        <div class="calc-callout">
          <span class="icon">🚗</span>
          <span class="text" id="lc-callout-text">—
            <span class="note">Assumes ~1 kg H₂ per 100 km and ~15,000 km/yr of driving, typical for a current-generation fuel-cell passenger car.</span>
          </span>
        </div>
      </div>

      <div class="calc-panel" id="calc-density" hidden>
        <p class="calc-desc">Check where a stack's operating point falls against the typical current density band for PEM electrolyzers.</p>
        <div class="calc-slider-row">
          <div class="calc-slider-head">
            <label for="cd-current">Stack current <span class="calc-tip" title="DC current delivered to the stack.">?</span></label>
            <span class="calc-slider-val" id="cd-current-val">—</span>
          </div>
          <input type="range" id="cd-current" min="20" max="500" step="5" value="200" />
        </div>
        <div class="calc-slider-row">
          <div class="calc-slider-head">
            <label for="cd-area">Active cell area <span class="calc-tip" title="Effective membrane area per cell.">?</span></label>
            <span class="calc-slider-val" id="cd-area-val">—</span>
          </div>
          <input type="range" id="cd-area" min="50" max="1000" step="5" value="300" />
        </div>
        <div class="calc-slider-row">
          <div class="calc-slider-head">
            <label for="cd-voltage">Cell voltage <span class="calc-tip" title="Voltage across a single cell at this operating point.">?</span></label>
            <span class="calc-slider-val" id="cd-voltage-val">—</span>
          </div>
          <input type="range" id="cd-voltage" min="1.2" max="2.2" step="0.01" value="1.8" />
        </div>
        <div class="calc-slider-row">
          <div class="calc-slider-head">
            <label for="cd-cells">Number of cells <span class="calc-tip" title="Cells in series making up the stack.">?</span></label>
            <span class="calc-slider-val" id="cd-cells-val">—</span>
          </div>
          <input type="range" id="cd-cells" min="10" max="300" step="1" value="50" />
        </div>
        <div class="calc-output"><span class="k">Current density (A/cm²)</span><span class="v" id="cd-out-density">—</span></div>
        <div class="calc-gauge" id="cd-gauge">
          <div class="calc-gauge-scale"><span>0.2 (low)</span><span>Typical PEM range</span><span>2.5 (high)</span></div>
          <div class="calc-gauge-track">
            <span class="calc-gauge-fill" style="width:0%"></span>
            <span class="calc-gauge-marker" style="left:0%"></span>
          </div>
        </div>
        <div class="calc-output"><span class="k">Power density (W/cm²)</span><span class="v" id="cd-out-power">—</span></div>
        <div class="calc-output"><span class="k">Total stack power (kW)</span><span class="v" id="cd-out-stack">—</span></div>
      </div>
    </div>`;
  wireCalcNav();
  wireUnitConversion();
  wireEfficiency();
  wireCapexOpex();
  wireLcoh();
  wireCurrentDensity();
}
