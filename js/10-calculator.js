/* ==========================================================================
   H2Grid · Hydrogen calculator (Tools tab)
   Five independent, live-recomputing calculators: unit conversion,
   efficiency, CAPEX/OPEX, LCOH, current density. Rendered lazily by the
   router's initToolsPage() hook (see js/09-router.js) on first visit to
   the Tools tab — this file defines that global function.
   Browser classic scripts share one global lexical scope, so helpers from
   core are visible here. Load order doesn't matter relative to
   09-router.js: DOMContentLoaded (when the router first runs) always
   fires after every synchronous <script> tag has executed.
   ======================================================================= */

function calcFmt(n, decimals) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(decimals);
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
}

function wireEfficiency() {
  document.getElementById("eff-sec").addEventListener("input", computeEfficiency);
  computeEfficiency();
}

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
}

function wireCapexOpex() {
  ["co-capacity", "co-capex", "co-opex", "co-life", "co-rate"].forEach((id) => {
    document.getElementById(id).addEventListener("input", computeCapexOpex);
  });
  computeCapexOpex();
}

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
}

function wireLcoh() {
  ["lc-annCost", "lc-price", "lc-sec", "lc-capacity", "lc-cf"].forEach((id) => {
    document.getElementById(id).addEventListener("input", computeLcoh);
  });
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
}

function wireCurrentDensity() {
  ["cd-current", "cd-area", "cd-voltage", "cd-cells"].forEach((id) => {
    document.getElementById(id).addEventListener("input", computeCurrentDensity);
  });
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
      <nav class="calc-nav">
        <button class="calc-tab active" data-calc="unit">Unit Conversion</button>
        <button class="calc-tab" data-calc="efficiency">Efficiency</button>
        <button class="calc-tab" data-calc="capex">CAPEX/OPEX</button>
        <button class="calc-tab" data-calc="lcoh">LCOH</button>
        <button class="calc-tab" data-calc="density">Current Density</button>
      </nav>
      <div class="calc-panel" id="calc-unit">
        <div class="calc-row"><label for="uc-value">Value</label><input type="number" id="uc-value" value="1" step="any" /></div>
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
        <div class="calc-row"><label for="eff-sec">Specific energy consumption (kWh/kg)</label><input type="number" id="eff-sec" value="55" step="any" /></div>
        <div class="calc-output"><span class="k">Efficiency vs. LHV (%)</span><span class="v" id="eff-out-lhv">—</span></div>
        <div class="calc-output"><span class="k">Efficiency vs. HHV (%)</span><span class="v" id="eff-out-hhv">—</span></div>
      </div>
      <div class="calc-panel" id="calc-capex" hidden>
        <div class="calc-row"><label for="co-capacity">Plant capacity (MW)</label><input type="number" id="co-capacity" value="10" step="any" /></div>
        <div class="calc-row"><label for="co-capex">CAPEX ($/kW)</label><input type="number" id="co-capex" value="1200" step="any" /></div>
        <div class="calc-row"><label for="co-opex">OPEX (%/yr of CAPEX)</label><input type="number" id="co-opex" value="3" step="any" /></div>
        <div class="calc-row"><label for="co-life">Plant lifetime (years)</label><input type="number" id="co-life" value="20" step="any" /></div>
        <div class="calc-row"><label for="co-rate">Discount rate (%)</label><input type="number" id="co-rate" value="8" step="any" /></div>
        <div class="calc-output"><span class="k">Total CAPEX ($)</span><span class="v" id="co-out-total">—</span></div>
        <div class="calc-output"><span class="k">Annualized CAPEX ($/yr)</span><span class="v" id="co-out-annCapex">—</span></div>
        <div class="calc-output"><span class="k">Annual OPEX ($/yr)</span><span class="v" id="co-out-annOpex">—</span></div>
        <div class="calc-output"><span class="k">Total annualized cost ($/yr)</span><span class="v" id="co-out-totalAnn">—</span></div>
      </div>
      <div class="calc-panel" id="calc-lcoh" hidden>
        <div class="calc-row"><label for="lc-annCost">Annualized CAPEX + OPEX ($/yr)</label><input type="number" id="lc-annCost" value="1200000" step="any" /></div>
        <div class="calc-row"><label for="lc-price">Electricity price ($/kWh)</label><input type="number" id="lc-price" value="0.05" step="any" /></div>
        <div class="calc-row"><label for="lc-sec">Specific energy consumption (kWh/kg)</label><input type="number" id="lc-sec" value="55" step="any" /></div>
        <div class="calc-row"><label for="lc-capacity">Plant capacity (MW)</label><input type="number" id="lc-capacity" value="10" step="any" /></div>
        <div class="calc-row"><label for="lc-cf">Capacity factor (%)</label><input type="number" id="lc-cf" value="90" step="any" /></div>
        <div class="calc-output"><span class="k">Annual H₂ production (kg)</span><span class="v" id="lc-out-prod">—</span></div>
        <div class="calc-output"><span class="k">Annual electricity cost ($)</span><span class="v" id="lc-out-elec">—</span></div>
        <div class="calc-output"><span class="k">LCOH ($/kg)</span><span class="v" id="lc-out-lcoh">—</span></div>
      </div>
      <div class="calc-panel" id="calc-density" hidden>
        <div class="calc-row"><label for="cd-current">Stack current (A)</label><input type="number" id="cd-current" value="200" step="any" /></div>
        <div class="calc-row"><label for="cd-area">Active cell area (cm²)</label><input type="number" id="cd-area" value="300" step="any" /></div>
        <div class="calc-row"><label for="cd-voltage">Cell voltage (V)</label><input type="number" id="cd-voltage" value="1.8" step="any" /></div>
        <div class="calc-row"><label for="cd-cells">Number of cells</label><input type="number" id="cd-cells" value="50" step="any" /></div>
        <div class="calc-output"><span class="k">Current density (A/cm²)</span><span class="v" id="cd-out-density">—</span></div>
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



