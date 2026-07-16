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
      <div class="calc-panel" id="calc-capex" hidden></div>
      <div class="calc-panel" id="calc-lcoh" hidden></div>
      <div class="calc-panel" id="calc-density" hidden></div>
    </div>`;
  wireCalcNav();
  wireUnitConversion();
  wireEfficiency();
}
