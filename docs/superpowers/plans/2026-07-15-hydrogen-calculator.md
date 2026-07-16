# Hydrogen Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill in the `#page-tools` tab with a real, self-contained hydrogen calculator: 5 independent, live-recomputing sub-calculators (unit conversion, efficiency, CAPEX/OPEX, LCOH, current density).

**Architecture:** One new module, `js/10-calculator.js`, defining the global `initToolsPage()` function the router (`js/09-router.js`, already built) already looks for and calls lazily on first visit to the Tools tab. The module renders a small local sub-nav (5 `.calc-tab` buttons, distinct from the main `.tab-btn` router nav to avoid DOM-query collisions) and 5 `.calc-panel` sections into `#page-tools`, each wired to its own live-recompute-on-input logic.

**Tech Stack:** Vanilla JS (classic scripts, shared global scope), no build step, no new dependencies.

## Global Constraints

- Classic scripts sharing one global lexical scope — no IIFEs/ES-modules (see README.md "Editing rules").
- No build step, no new external dependencies, no live data fetch — purely computational, static editable defaults.
- The calculator's internal sub-nav MUST use a class name other than `.tab-btn` — the main router (`js/09-router.js`) does `document.querySelectorAll(".tab-btn").forEach(...)` on every navigation and would incorrectly strip the `active` class from any element sharing that class name. Use `.calc-tab` instead.
- All 5 calculators are independent — no cross-calculator data sharing or pre-filling (explicit design decision, see spec).
- Every calculator recomputes live on the `input` (or `change`, for the unit dropdown) event — no submit button.
- Division-by-zero / non-finite results render as `—`, never `NaN`/`Infinity`.
- Number formatting uses `n.toFixed(decimals)`, not `toLocaleString` — deterministic across locales, no thousands-separator commas (acceptable for a calculator tool; avoids locale-dependent test behavior).

---

## Task 1: Calculator shell + Unit Conversion + Efficiency

**Files:**
- Create: `js/10-calculator.js`
- Modify: `index.html`
- Modify: `style.css`
- Modify: `js/smoke-test.js`

**Interfaces:**
- Consumes: router's lazy-init mechanism (`js/09-router.js`'s `ROUTES.tools.init === "initToolsPage"`, already built — no router changes needed).
- Produces: `calcFmt(n, decimals)`, `wireCalcNav()`, `computeUnitConversion()`/`wireUnitConversion()`, `computeEfficiency()`/`wireEfficiency()`, `initToolsPage()`. Task 2 appends three more compute/wire pairs to this same file and calls them from `initToolsPage()`.

- [ ] **Step 1: Add the failing assertions to smoke-test.js first**

Find the last line of the router assertions (added by the router plan):

```js
  ok(!!doc.getElementById("map"), "map container still present after returning to the Map tab");
```

Add immediately after it:

```js

  // Hydrogen calculator (Tools tab) — Task 1: shell + Unit Conversion + Efficiency
  click(doc.querySelector('.tab-btn[data-route="tools"]'));
  ok(!doc.getElementById("page-tools").hidden, "tools page shown after clicking Tools tab");
  ok(doc.querySelectorAll(".calc-tab").length === 5, "calculator has 5 sub-tabs");
  ok(doc.querySelector('.calc-tab[data-calc="unit"]').classList.contains("active"), "Unit Conversion sub-tab active by default");
  ok(!doc.getElementById("calc-unit").hidden, "Unit Conversion panel visible by default");
  ok(doc.getElementById("calc-efficiency").hidden, "Efficiency panel hidden by default");

  ok(doc.getElementById("uc-out-kg").textContent === "1.0000", "unit conversion: 1 kg default renders 1.0000 kg");
  ok(doc.getElementById("uc-out-kwh_lhv").textContent === "33.33", "unit conversion: 1 kg = 33.33 kWh (LHV)");
  const ucValue = doc.getElementById("uc-value");
  ucValue.value = "";
  ucValue.dispatchEvent(new window.Event("input", { bubbles: true }));
  ok(doc.getElementById("uc-out-kg").textContent === "—", "unit conversion: empty input renders — not NaN");
  ucValue.value = "1";
  ucValue.dispatchEvent(new window.Event("input", { bubbles: true }));

  click(doc.querySelector('.calc-tab[data-calc="efficiency"]'));
  ok(doc.querySelector('.calc-tab[data-calc="efficiency"]').classList.contains("active"), "Efficiency sub-tab becomes active on click");
  ok(!doc.getElementById("calc-efficiency").hidden, "Efficiency panel shown after click");
  ok(doc.getElementById("calc-unit").hidden, "Unit Conversion panel hidden after switching tabs");
  ok(doc.getElementById("eff-out-lhv").textContent === "60.6", "efficiency: 55 kWh/kg default renders 60.6% vs LHV");
  ok(doc.getElementById("eff-out-hhv").textContent === "71.6", "efficiency: 55 kWh/kg default renders 71.6% vs HHV");
  const effSec = doc.getElementById("eff-sec");
  effSec.value = "0";
  effSec.dispatchEvent(new window.Event("input", { bubbles: true }));
  ok(doc.getElementById("eff-out-lhv").textContent === "—", "efficiency: zero input renders — not Infinity");
  effSec.value = "55";
  effSec.dispatchEvent(new window.Event("input", { bubbles: true }));
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node js/smoke-test.js`
Expected: `FAIL  tools page shown after clicking Tools tab` (and the rest of the new assertions also FAIL — none of this exists yet).

- [ ] **Step 3: Empty out the page-tools placeholder in index.html**

Find:

```html
<section id="page-tools" class="page" hidden>
  <div class="page-placeholder"><h2>Tools</h2><p>Coming soon.</p></div>
</section>
```

Replace with:

```html
<section id="page-tools" class="page" hidden></section>
```

- [ ] **Step 4: Add the script tag to index.html**

Find:

```html
<script src="js/09-router.js"></script>
</body>
```

Replace with:

```html
<script src="js/09-router.js"></script>
<script src="js/10-calculator.js"></script>
</body>
```

- [ ] **Step 5: Create js/10-calculator.js**

```js
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
```

- [ ] **Step 6: Add CSS for the calculator shell**

Find:

```css
.page[hidden] { display: none; }
```

Replace with:

```css
.page[hidden] { display: none; }

/* ---------- Hydrogen calculator (Tools tab) ---------- */
#page-tools { padding: 90px 20px 40px; min-height: 100vh; display: flex; justify-content: center; }
.tools-shell { width: 100%; max-width: 640px; }
.calc-nav {
  display: flex; flex-wrap: wrap; gap: 2px;
  margin-bottom: 16px; padding: 4px 5px;
  background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-md);
}
.calc-tab {
  font-size: 10.5px; font-weight: 500; letter-spacing: 0.02em;
  padding: 6px 11px;
  color: var(--text-muted);
  background: transparent;
  border: none; border-radius: 6px;
  cursor: pointer;
  transition: all 0.14s ease;
  white-space: nowrap;
}
.calc-tab.active {
  color: var(--text-hi);
  background: rgba(63, 214, 232, 0.13);
  box-shadow: inset 0 0 0 1px var(--line-accent);
}
.calc-tab:hover:not(.active) { color: var(--text); }
.calc-panel {
  background: var(--panel-strong); border: 1px solid var(--line); border-radius: var(--r-lg);
  padding: 20px;
}
.calc-row { display: grid; grid-template-columns: 1fr 120px; align-items: center; gap: 10px; margin: 10px 0; font-size: 12px; }
.calc-row label { color: var(--text-muted); }
.calc-row input, .calc-row select {
  font: inherit; font-size: 12px; padding: 6px 8px;
  background: var(--bg-1); border: 1px solid var(--line); border-radius: 6px;
  color: var(--text-hi); width: 100%;
}
.calc-row input:focus, .calc-row select:focus { outline: 1px solid var(--cyan); border-color: var(--cyan); }
.calc-output {
  display: flex; justify-content: space-between; align-items: baseline;
  padding: 8px 0; border-top: 1px solid var(--line); font-size: 12px;
}
.calc-output .k { color: var(--text-faint); font: var(--overline); letter-spacing: var(--overline-tracking); }
.calc-output .v { color: var(--cyan); font-weight: 600; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 7: Run the test and confirm it passes**

Run: `node js/smoke-test.js`
Expected: `ALL TESTS PASSED`, including every new calculator assertion.

- [ ] **Step 8: Commit**

```bash
git add index.html js/10-calculator.js style.css js/smoke-test.js
git commit -m "feat: add hydrogen calculator shell with unit conversion and efficiency"
```

---

## Task 2: CAPEX/OPEX, LCOH, Current Density calculators

**Files:**
- Modify: `js/10-calculator.js`
- Modify: `js/smoke-test.js`

**Interfaces:**
- Consumes: `calcFmt(n, decimals)` (from Task 1), the `.calc-panel`/`.calc-row`/`.calc-output` CSS classes (from Task 1).
- Produces: `computeCapexOpex()`/`wireCapexOpex()`, `computeLcoh()`/`wireLcoh()`, `computeCurrentDensity()`/`wireCurrentDensity()` — no later task depends on these.

- [ ] **Step 1: Add the failing assertions to smoke-test.js first**

Find the last line added in Task 1:

```js
  effSec.value = "55";
  effSec.dispatchEvent(new window.Event("input", { bubbles: true }));
```

Add immediately after it:

```js

  // Hydrogen calculator — Task 2: CAPEX/OPEX, LCOH, Current Density
  click(doc.querySelector('.calc-tab[data-calc="capex"]'));
  ok(!doc.getElementById("calc-capex").hidden, "CAPEX/OPEX panel shown after click");
  ok(doc.getElementById("co-out-total").textContent === "12000000.00", "capex/opex: defaults render total CAPEX 12000000.00");
  const coRate = doc.getElementById("co-rate");
  coRate.value = "0";
  coRate.dispatchEvent(new window.Event("input", { bubbles: true }));
  ok(doc.getElementById("co-out-annCapex").textContent === "600000.00", "capex/opex: 0% discount rate gives annualized CAPEX = total/lifetime = 600000.00");
  const coLife = doc.getElementById("co-life");
  coLife.value = "0";
  coLife.dispatchEvent(new window.Event("input", { bubbles: true }));
  ok(doc.getElementById("co-out-annCapex").textContent === "—", "capex/opex: zero lifetime renders — not Infinity/NaN");
  ok(doc.getElementById("co-out-total").textContent === "12000000.00", "capex/opex: total CAPEX unaffected by lifetime (independent calc)");
  coLife.value = "20";
  coLife.dispatchEvent(new window.Event("input", { bubbles: true }));
  coRate.value = "8";
  coRate.dispatchEvent(new window.Event("input", { bubbles: true }));

  click(doc.querySelector('.calc-tab[data-calc="lcoh"]'));
  ok(!doc.getElementById("calc-lcoh").hidden, "LCOH panel shown after click");
  ok(doc.getElementById("lc-out-prod").textContent !== "—", "lcoh: defaults render a finite annual production figure");
  ok(doc.getElementById("lc-out-lcoh").textContent !== "—", "lcoh: defaults render a finite LCOH figure");
  const lcSec = doc.getElementById("lc-sec");
  lcSec.value = "0";
  lcSec.dispatchEvent(new window.Event("input", { bubbles: true }));
  ok(doc.getElementById("lc-out-prod").textContent === "—", "lcoh: zero specific energy consumption renders — not Infinity");
  ok(doc.getElementById("lc-out-lcoh").textContent === "—", "lcoh: LCOH also — when production is undefined");
  lcSec.value = "55";
  lcSec.dispatchEvent(new window.Event("input", { bubbles: true }));

  click(doc.querySelector('.calc-tab[data-calc="density"]'));
  ok(!doc.getElementById("calc-density").hidden, "Current Density panel shown after click");
  ok(doc.getElementById("cd-out-density").textContent === "0.667", "current density: 200A / 300cm2 defaults render 0.667 A/cm2");
  ok(doc.getElementById("cd-out-stack").textContent === "18.00", "current density: 50 cells * 1.8V * 200A / 1000 renders 18.00 kW stack power");
  const cdArea = doc.getElementById("cd-area");
  cdArea.value = "0";
  cdArea.dispatchEvent(new window.Event("input", { bubbles: true }));
  ok(doc.getElementById("cd-out-density").textContent === "—", "current density: zero area renders — not Infinity");
  ok(doc.getElementById("cd-out-stack").textContent === "18.00", "current density: stack power unaffected by area (independent calc)");
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `node js/smoke-test.js`
Expected: `FAIL  CAPEX/OPEX panel shown after click` (and the rest of the new assertions also FAIL — the three panels are still empty placeholders and no compute/wire functions exist for them yet).

- [ ] **Step 3: Fill in the three empty panels**

In `js/10-calculator.js`, find:

```js
      <div class="calc-panel" id="calc-capex" hidden></div>
      <div class="calc-panel" id="calc-lcoh" hidden></div>
      <div class="calc-panel" id="calc-density" hidden></div>
```

Replace with:

```js
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
```

- [ ] **Step 4: Add the three compute/wire function pairs**

Find:

```js
function wireCalcNav() {
```

Replace with:

```js
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
```

- [ ] **Step 5: Wire the three new calculators into initToolsPage()**

Find:

```js
  wireCalcNav();
  wireUnitConversion();
  wireEfficiency();
}
```

Replace with:

```js
  wireCalcNav();
  wireUnitConversion();
  wireEfficiency();
  wireCapexOpex();
  wireLcoh();
  wireCurrentDensity();
}
```

- [ ] **Step 6: Run the test and confirm it passes**

Run: `node js/smoke-test.js`
Expected: `ALL TESTS PASSED`, including every new CAPEX/OPEX, LCOH, and Current Density assertion.

- [ ] **Step 7: Commit**

```bash
git add js/10-calculator.js js/smoke-test.js
git commit -m "feat: add CAPEX/OPEX, LCOH, and current density calculators"
```

---

## Post-implementation manual check

1. Start the dev server (`static-server` in `.claude/launch.json`, or `npx http-server -p 8000 -c-1`).
2. Click the "🧮 Tools" tab — confirm all 5 sub-tabs render and Unit Conversion is active by default.
3. Change the Unit Conversion value/unit — confirm all 5 output rows update live.
4. Click through all 5 sub-tabs — confirm each panel's inputs/outputs render correctly and changing an input recomputes only that panel's outputs.
5. In CAPEX/OPEX, set lifetime to 0 — confirm Annualized CAPEX shows `—` while Total CAPEX and Annual OPEX still show numbers (they don't depend on lifetime).
6. In Current Density, set active area to 0 — confirm Current/Power density show `—` while Total stack power still computes.
7. Switch to a different top-level tab (e.g. Map) and back to Tools — confirm the calculator's current input values and sub-tab selection persist (the whole `#page-tools` section is just hidden/shown, not torn down, since `initToolsPage()` only runs once).
