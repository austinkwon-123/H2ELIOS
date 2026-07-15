# Hydrogen Calculator — Design Spec

Date: 2026-07-15
Status: Approved by user

## Summary

Fill in the `#page-tools` tab (currently a "Coming soon" placeholder from the
Phase 0 router shell) with a real, self-contained hydrogen calculator: five
independent, live-recomputing sub-calculators covering unit conversions,
electrolyzer efficiency, CAPEX/OPEX, LCOH, and current density. Purely
computational — no new data source, no AI, no live fetch. This is Phase 1
of the 11-feature roadmap (the one item with no external dependencies).

## Why independent, not linked

Each of the 5 calculators is fully self-contained (own inputs, own outputs,
no cross-tab data sharing). This is a deliberate v1 simplification: linking
them (e.g. feeding CAPEX/OPEX's annualized cost into LCOH automatically)
adds real state-management complexity for a first version, and each
calculator is independently useful and independently testable this way.
Cross-linking is a reasonable future enhancement, explicitly out of scope
here.

## Structure

`#page-tools` gets a sub-nav (5 buttons, same `.tab-btn`-style visual
language as the main `#tab-nav`, but scoped inside the page) and 5 panels,
one visible at a time (same show/hide pattern as the main router, but
local — no hash/URL involvement, this is a within-page detail, not a new
route). All fields are `<input type="number">`; every calculator
recomputes on the `input` event, no submit button — matches the rest of
the app's live-recompute convention (Network bars, Markets).

**File:** new `js/10-calculator.js`, hooked in as the global
`initToolsPage()` function the router (`js/09-router.js`, already built)
already looks for and calls lazily on first visit to the Tools tab — no
router changes needed.

## The 5 calculators

### 1. Unit Conversion
Input: a value + a unit (kg H₂, Nm³ H₂, kWh LHV, kWh HHV, MJ). Output: the
same quantity in all other units, computed live.
Constants (normal conditions, 0°C/1 atm): LHV = 33.33 kWh/kg (120 MJ/kg),
HHV = 39.4 kWh/kg (142 MJ/kg), 1 kg H₂ = 11.126 Nm³.
Default: 1 kg.

### 2. Efficiency
Input: specific energy consumption (kWh/kg, default **55**, typical
PEM/ALK electrolyzer range).
Output: efficiency vs. LHV = `33.33 / input × 100`, efficiency vs. HHV =
`39.4 / input × 100`.

### 3. CAPEX/OPEX
Inputs: plant capacity (MW, default **10**), CAPEX ($/kW, default
**1200**), OPEX (%/yr of CAPEX, default **3**), plant lifetime (years,
default **20**), discount rate (%, default **8**).
Outputs:
- Total CAPEX = `capacity_MW × 1000 × capex_per_kW`
- Capital recovery factor `CRF = r(1+r)^n / ((1+r)^n − 1)` where `r` =
  discount rate, `n` = lifetime
- Annualized CAPEX = `Total CAPEX × CRF`
- Annual OPEX = `Total CAPEX × opex_pct / 100`
- Total annualized cost = `Annualized CAPEX + Annual OPEX`

### 4. LCOH (Levelized Cost of Hydrogen)
Inputs: annualized CAPEX+OPEX ($/yr, default **1,200,000** — a standalone
number the user enters directly, not pulled from calculator #3), 
electricity price ($/kWh, default **0.05**), specific energy consumption
(kWh/kg, default **55**), plant capacity (MW, default **10**), capacity
factor (%, default **90**).
Outputs:
- Annual H₂ production (kg) = `capacity_MW × 1000 × 8760 × capacity_factor/100 / specific_energy_kWh_per_kg`
- Annual electricity cost = `Annual H₂ production × specific_energy_kWh_per_kg × electricity_price`
- LCOH ($/kg) = `(annualized CAPEX+OPEX + Annual electricity cost) / Annual H₂ production`

### 5. Current Density
Inputs: stack current (A, default **200**), active cell area (cm²,
default **300**), cell voltage (V, default **1.8**), number of cells
(default **50**).
Outputs:
- Current density (A/cm²) = `current / area`
- Power density (W/cm²) = `current density × voltage`
- Total stack power (kW) = `cells × voltage × current / 1000`

All default values are clearly-labeled, editable starting points for the
calculator form (typical industry-range figures for a mid-size PEM/ALK
electrolyzer) — not a claim about real current market data. Every field
has a visible label stating its unit.

## Error handling

Division by zero (e.g. active area = 0, or lifetime/discount rate
producing a degenerate CRF) shows `—` in the affected output field rather
than `NaN`/`Infinity`. Negative inputs are not specially blocked (a
calculator should let the user explore the math), but any resulting
non-finite output still falls back to `—`.

## Out of scope

- No live default values (static, editable — per earlier discussion).
- No cross-calculator linking/pre-filling.
- No persistence (values reset to defaults on page reload — this is a
  scratch calculator, not a saved-scenario tool).
- No unit tests beyond the existing smoke-test convention (DOM-level
  input→output assertions, matching how the rest of this app is tested).

## Testing

Extend `js/smoke-test.js`: navigate to the Tools tab (exercises the
router's lazy-init hook, first real use of that mechanism since Phase 0),
confirm the 5 sub-tabs exist and the first is active by default, and for
each calculator set inputs and assert the computed output text matches
the expected value for at least one non-trivial case (not just "some text
appeared") — plus one division-by-zero case per calculator that has one,
asserting `—` renders instead of `NaN`.
