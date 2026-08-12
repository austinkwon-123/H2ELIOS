/* ==========================================================================
   H2Grid · Policy & Regulation Tab Module
   Policy Impact Simulators, Regional Target Trackers, and Regulatory timelines.
   ======================================================================= */

// Illustrative policy-update examples with invented specific dates - SAMPLE
// data, not a live feed. An earlier version faked a "Live: HH:MM:SS"
// timestamp against a non-existent api.h2grid.org endpoint, implying these
// were real dated news events; fixed the same way as the other tabs.
const POLICY_SAMPLE_DATA = {
  policies: [
    {
      id: "p1",
      date: "2026-06-15",
      region: "europe",
      impact: "positive",
      affects: "Demand mandate",
      title: "EU RED III Renewable H₂ Mandate Enacted",
      desc: "Requires 42% of industrial hydrogen to be renewable RFNBOs (Renewable Fuels of Non-Biological Origin) by 2030, rising to 60% by 2035. Creates a binding demand sink."
    },
    {
      id: "p2",
      date: "2026-05-20",
      region: "americas",
      impact: "neutral",
      affects: "Production credit",
      title: "US IRS Issues Final 45V Clean H₂ Tax Credit Guidance",
      desc: "Maintains strict hourly matching, additionality, and deliverability rules (the 'three pillars'), prompting developer appeals but resolving industry compliance uncertainty."
    },
    {
      id: "p3",
      date: "2026-04-12",
      region: "apac",
      impact: "positive",
      affects: "Import rule",
      title: "Japan basic hydrogen strategy updates sub-targets",
      desc: "Allocates ¥3 trillion sub-grants ($20.3B) in contracts-for-difference (CfD) funding over 15 years to bridge the price gap between clean and gray hydrogen imports."
    },
    {
      id: "p4",
      date: "2026-03-28",
      region: "americas",
      impact: "negative",
      affects: "Production credit",
      title: "Canada Clean Hydrogen Tax Credit Delay",
      desc: "Administrative backlogs delay the processing of the 15-40% investment tax credits (ITCs) for major production projects in Alberta, pushing back targeted FIDs."
    },
    {
      id: "p5",
      date: "2026-02-14",
      region: "mena",
      impact: "positive",
      affects: "Infrastructure grant",
      title: "Oman Hydro-Fides signs joint-development deals",
      desc: "Ministry of Energy guarantees royalty-free land use and direct port access corridors in Salalah and Duqm for green ammonia export pipelines."
    },
    {
      id: "p6",
      date: "2026-01-18",
      region: "europe",
      impact: "neutral",
      affects: "Infrastructure grant",
      title: "Germany updates National Hydrogen Strategy (H₂-Kernnetz)",
      desc: "Federal network agency approves a 9,040 km core transport grid blueprint, planning pipeline blending conversions to link inland steel mills."
    }
  ]
};

// Simpler, editorial status language — "Positive Demand/Subsidy" read like
// a system code; a real policy briefing would just say what's true. The
// dimension a policy actually touches (production credit, demand mandate,
// import rule, infrastructure grant) is shown as its own tag rather than
// folded into the status word, since a policy can be Supportive of a
// production credit or Delayed on an infrastructure grant — two separate
// facts, not one.
function policyStatusLabel(impact) {
  return { positive: "Supportive", neutral: "Under review", negative: "Delayed" }[impact] || "Under review";
}
function policyStatusColor(impact) {
  return { positive: "var(--green-ok)", neutral: "var(--amber)", negative: "var(--red)" }[impact] || "var(--amber)";
}

const REGIONAL_TARGETS = {
  us: {
    country: "United States (IRA & Clean H2 Roadmap)",
    goal: "10 Million Metric Tons (MMT) clean production by 2030",
    budget: "$9.5B Infrastructure Act + uncapped 45V tax credits",
    standard: "Hourly energy matching, additionality, and regionality by 2028",
    mechanism: "Section 45V production tax credits sliding up to $3.00/kg",
    source: "https://www.hydrogen.energy.gov/library/roadmaps-vision/clean-hydrogen-strategy-roadmap"
  },
  eu: {
    country: "European Union (RePowerEU & RED III)",
    goal: "10 MMT domestic production + 10 MMT imports by 2030",
    budget: "€4.5B Innovation Fund auctions & national CfD budgets",
    standard: "Strict RFNBO delegated acts (additionality & temporal matching)",
    mechanism: "Fixed premium subsidy auctions per kg H2 produced",
    source: "https://commission.europa.eu/strategy-and-policy/priorities-2019-2024/european-green-deal/repowereu-affordable-secure-and-sustainable-energy-europe_en"
  },
  germany: {
    country: "Germany (H2Global & Kernnetz)",
    goal: "10 GW domestic electrolyzer capacity by 2030",
    budget: "€20B+ federal amortization backing + €4B+ H2Global imports",
    standard: "RFNBO criteria matched to core transportation network links",
    mechanism: "H2Global double-auction and Carbon Contracts for Difference (CCfD)",
    source: "https://www.bmwk.de/Redaktion/EN/Dossier/hydrogen.html"
  },
  apac: {
    country: "Japan (Basic Hydrogen Strategy)",
    goal: "Up to 3 MMT hydrogen and ammonia supply by 2030",
    budget: "Public support and private investment under the Basic Hydrogen Strategy",
    standard: "Low-carbon hydrogen and ammonia supply certification",
    mechanism: "Long-term support for low-carbon hydrogen and ammonia supply",
    source: "https://www.meti.go.jp/shingikai/enecho/shoene_shinene/suiso_seisaku/pdf/20230606_5.pdf"
  }
};

let selectedRegionTargetKey = "us";
let selectedPolicyId = null;

// Chronological rail (left) + reading pane (right), replacing the old
// single scrolling list that put a policy's full description inline no
// matter how many were on screen — fine for six sample rows, but the rail
// is the shape that still works once this is a real feed with dozens of
// entries: scan dates and titles at a glance, read one at a time.
function filteredPolicies(data, filterRegion) {
  const query = document.getElementById("p-search") ? document.getElementById("p-search").value.toLowerCase() : "";
  const impactFilter = document.getElementById("p-impact-filter") ? document.getElementById("p-impact-filter").value : "all";
  return data.policies.filter(p => {
    const matchesRegion = filterRegion === "all" || p.region === filterRegion;
    const matchesSearch = p.title.toLowerCase().includes(query) || p.desc.toLowerCase().includes(query);
    const matchesImpact = impactFilter === "all" || p.impact === impactFilter;
    return matchesRegion && matchesSearch && matchesImpact;
  });
}

function renderPolicyList(data, filterRegion = "all") {
  const rail = document.getElementById("policy-rail-container");
  const pane = document.getElementById("policy-reading-pane");
  if (!rail || !pane) return;

  const filtered = filteredPolicies(data, filterRegion);

  if (!filtered.length) {
    rail.innerHTML = `<div style="text-align:center; color:var(--text-faint); padding:24px 0; font-size:11.5px;">No matches.</div>`;
    pane.innerHTML = `<div style="text-align:center; color:var(--text-faint); padding:24px 0; font-size:11.5px;">No recent regulatory updates match criteria.</div>`;
    selectedPolicyId = null;
    return;
  }

  if (!filtered.some((p) => p.id === selectedPolicyId)) selectedPolicyId = filtered[0].id;

  rail.innerHTML = filtered.map((p) => `
    <button class="policy-rail-item${p.id === selectedPolicyId ? " active" : ""}" data-id="${p.id}" style="--rail-color:${policyStatusColor(p.impact)}">
      <span class="policy-rail-date">${p.date}</span>
      <span class="policy-rail-title">${escapeHtml(p.title)}</span>
    </button>
  `).join("");

  rail.querySelectorAll(".policy-rail-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedPolicyId = btn.dataset.id;
      renderPolicyList(data, filterRegion);
    });
  });

  renderPolicyReadingPane(filtered.find((p) => p.id === selectedPolicyId));
}

function renderPolicyReadingPane(p) {
  const pane = document.getElementById("policy-reading-pane");
  if (!pane || !p) return;
  const color = policyStatusColor(p.impact);
  pane.innerHTML = `
    <div style="display:flex; flex-direction:column; gap:10px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
        <span style="font-family:var(--font-mono); font-size:10px; color:var(--text-faint);">${p.date} · ${regionLabel(p.region)}</span>
        <div style="display:flex; gap:6px;">
          <span style="font-size:9.5px; font-weight:600; padding:2px 8px; border-radius:999px; background:rgba(255,255,255,0.04); color:var(--text-muted);">${escapeHtml(p.affects || "")}</span>
          <span style="font-size:9.5px; font-weight:600; padding:2px 8px; border-radius:999px; background:${color}22; color:${color};">${policyStatusLabel(p.impact)}</span>
        </div>
      </div>
      <h4 style="font-family:var(--font); font-size:14px; color:var(--text-hi); margin:0;">${escapeHtml(p.title)}</h4>
      <p style="font-size:12px; color:var(--text-muted); line-height:1.5; margin:0;">${escapeHtml(p.desc)}</p>
    </div>
  `;
  animateDetailIn(pane);
}

// 1. Sliders Math: Policy Impact Competitiveness Simulator
function runPolicyCompetitivenessCalc() {
  const greenLcoh = parseFloat(document.getElementById("calc-green-lcoh").value);
  const carbonTax = parseFloat(document.getElementById("calc-carbon-tax").value);
  const prodSubsidy = parseFloat(document.getElementById("calc-prod-subsidy").value);

  // Grey Hydrogen economics:
  // Baseline cost: $1.80/kg H2
  // CO2 intensity: 9 kg CO2 per kg grey H2 produced via SMR
  const greyBaselineCost = 1.80;
  const carbonIntensityGrey = 9; // kg CO2/kg H2
  
  const greyCarbonPenalty = (carbonTax * carbonIntensityGrey) / 1000; // $/kg H2
  const finalGreyCost = greyBaselineCost + greyCarbonPenalty;

  // Green Hydrogen net cost: Green LCOH minus the Production Subsidy (e.g. IRA PTC)
  const netGreenCost = Math.max(0.1, greenLcoh - prodSubsidy);

  // Update slider labels
  document.getElementById("green-lcoh-lbl").textContent = `$${greenLcoh.toFixed(2)}/kg`;
  document.getElementById("carbon-tax-lbl").textContent = `$${carbonTax}/ton`;
  document.getElementById("prod-subsidy-lbl").textContent = `$${prodSubsidy.toFixed(2)}/kg`;

  // Update outputs
  document.getElementById("sim-grey-penalty").textContent = `+$${greyCarbonPenalty.toFixed(2)}/kg`;
  document.getElementById("sim-grey-total").textContent = `$${finalGreyCost.toFixed(2)}/kg`;
  document.getElementById("sim-green-net").textContent = `$${netGreenCost.toFixed(2)}/kg`;

  // Verdict panel logic
  const verdictEl = document.getElementById("sim-policy-verdict");
  if (verdictEl) {
    if (netGreenCost <= finalGreyCost) {
      verdictEl.innerHTML = `
        <div style="background:rgba(76,195,138,0.1); border:1px solid rgba(76,195,138,0.3); border-radius:4px; padding:10px; text-align:center; color:var(--green-ok);">
          <strong style="font-size:11px;">Green H₂ is cost-competitive</strong>
          <p style="font-size:10px; margin:4px 0 0 0; color:var(--text-muted);">Green net cost ($${netGreenCost.toFixed(2)}) is equal to or below taxed Grey hydrogen ($${finalGreyCost.toFixed(2)}).</p>
        </div>
      `;
    } else {
      const spread = netGreenCost - finalGreyCost;
      verdictEl.innerHTML = `
        <div style="background:rgba(217,154,61,0.1); border:1px solid rgba(217,154,61,0.3); border-radius:4px; padding:10px; text-align:center; color:var(--amber);">
          <strong style="font-size:11px;">Green H₂ requires support</strong>
          <p style="font-size:10px; margin:4px 0 0 0; color:var(--text-muted);">Cost gap of $${spread.toFixed(2)}/kg exists. Increase carbon tax or production subsidies to close the gap.</p>
        </div>
      `;
    }
  }
}

// 2. Interactive Global Mandate Catalog
function selectRegionalTarget(key) {
  selectedRegionTargetKey = key;
  const d = REGIONAL_TARGETS[key];
  if (!d) return;

  document.querySelectorAll(".mandate-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.target === key);
  });

  const detailsContainer = document.getElementById("mandate-details-container");
  if (detailsContainer) {
    const mapRegion = { us: "americas", eu: "europe", germany: "europe", apac: "apac" }[key];
    const mapRegionLabel = { americas: "Americas", europe: "Europe", apac: "Asia-Pacific" }[mapRegion];
    const hasMappedRecords = Boolean(mapRegion && window.IEA_DATA?.features.some((feature) =>
      !Number(feature.properties?.approx) && (REGION_GROUPS[mapRegion] || []).includes(feature.properties?.region)
    ));
    detailsContainer.innerHTML = `
      <div style="background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-md); padding:14px; display:flex; flex-direction:column; gap:10px;">
        <h4 style="font-size:12px; font-family:var(--font); color:var(--text-hi); margin:0;">${escapeHtml(d.country)}</h4>
        <dl style="display:grid; grid-template-columns:110px 1fr; gap:6px; font-size:11px; margin:0; line-height:1.4;">
          <dt style="color:var(--text-faint); font-weight:600; font-size:10.5px;">2030 target</dt>
          <dd style="color:var(--text-hi); font-weight:500; margin:0;">${escapeHtml(d.goal)}</dd>
          
          <dt style="color:var(--text-faint); font-weight:600; font-size:10.5px;">Allocated budget</dt>
          <dd style="color:var(--cyan); font-weight:600; margin:0;">${escapeHtml(d.budget)}</dd>
          
          <dt style="color:var(--text-faint); font-weight:600; font-size:10.5px;">Compliance rules</dt>
          <dd style="color:var(--text-muted); margin:0;">${escapeHtml(d.standard)}</dd>
          
          <dt style="color:var(--text-faint); font-weight:600; font-size:10.5px;">Subsidy tool</dt>
          <dd style="color:var(--green-ok); font-weight:600; margin:0;">${escapeHtml(d.mechanism)}</dd>
        </dl>
        <div class="policy-source-actions">
          <a href="${escapeAttr(d.source)}" target="_blank" rel="noopener">Official source ↗</a>
          ${hasMappedRecords ? `<button type="button" class="tab-btn" data-policy-map-region="${mapRegion}">Apply ${mapRegionLabel} to map</button>` : ""}
        </div>
      </div>
    `;
    detailsContainer.querySelector("[data-policy-map-region]")?.addEventListener("click", (event) => {
      const region = event.currentTarget.dataset.policyMapRegion;
      window.beginMapHandoff?.({ fromRoute: "policy", label: "Policy", filters: { region }, selectionId: null });
    });
    animateDetailIn(detailsContainer);
  }
}

function initPolicyPage() {
  const el = document.getElementById("page-policy");
  if (!el) return;

  el.innerHTML = `
    <div class="page-container" style="display:flex; flex-direction:column; gap:20px;">
      
      <!-- Page Header -->
      <div class="page-header" style="border-bottom: 1px solid var(--line); padding-bottom: 12px; margin-bottom: 8px;">
        <h2>Policy &amp; Regulation</h2>
        <p>Recent policy changes, tariff guidelines, subsidy frameworks, and regional clean hydrogen target trackers.</p>
      </div>

      <!-- Filters Row -->
      <div class="search-filter-row policy-region-filter" style="display:flex; align-items:center; gap:12px; background:rgba(0,0,0,0.1); padding:10px 14px; border-radius:var(--r-md); border:1px solid var(--line);">
        <label for="p-region-select" style="font-size: 11px; color: var(--text-muted);">Region Filter:</label>
        <select id="p-region-select" style="background:var(--bg-1); color:var(--text-hi); border:1px solid var(--line); padding:4px 8px; border-radius:4px; font-size:11.5px;">
          <option value="all">🌐 All Regions</option>
          <option value="americas">Americas</option>
          <option value="europe">Europe</option>
          <option value="mena">Middle East &amp; Africa</option>
          <option value="apac">Asia-Pacific</option>
        </select>
      </div>

      <!-- Main Visual Grid -->
      <div class="policy-main-grid" style="display:grid; grid-template-columns: 1.1fr 0.9fr; gap:16px;">

        <!-- Left: Searchable Policy timeline Feed -->
        <div class="dashboard-card glass" data-provenance="illustrative" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:12px;">
          <h3 style="font-size:14px; font-family:var(--font); color:var(--text-hi);">Policy Timeline &amp; Impacts <span class="badge badge-sample">Sample</span></h3>
          <p style="font-size:10.5px; color:var(--text-faint); line-height:1.4; margin:-6px 0 0;">Illustrative examples of the kind of updates tracked here, not a live regulatory feed.</p>

          <div class="policy-search-controls" style="display:flex; gap:8px; align-items:center;">
            <input type="text" id="p-search" placeholder="Search regulations or keywords..."
                   style="flex:1; background:var(--bg-1); border:1px solid var(--line); border-radius:4px; padding:6px 12px; color:var(--text-hi); font-size:11.5px; outline:none;" />
            <select id="p-impact-filter" style="background:var(--bg-1); border:1px solid var(--line); border-radius:4px; padding:5px 8px; color:var(--text-hi); font-size:11.5px;">
              <option value="all">Impact: All</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral/Guidance</option>
              <option value="negative">Delay/Barrier</option>
            </select>
          </div>

          <div class="policy-timeline-grid" style="display:grid; grid-template-columns: 190px 1fr; gap:12px; min-height:280px;">
            <div id="policy-rail-container" class="policy-rail"></div>
            <div id="policy-reading-pane" class="mat-shelf" style="padding:16px;"></div>
          </div>
        </div>

        <!-- Right: Policy Impact Simulator & Mandates Roster -->
        <div class="policy-side-column" style="display:flex; flex-direction:column; gap:16px;">
          
          <!-- Competitiveness Simulator -->
          <div class="dashboard-card glass" data-provenance="illustrative" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:10px;">
            <h3 style="font-size:14px; font-family:var(--font); color:var(--text-hi);">Policy Impact &amp; Parity Simulator</h3>
            <p style="font-size: 11px; color: var(--text-muted); line-height: 1.4; margin:0;">
              Analyze how carbon taxes and PTC production credits close the cost gap between green and grey hydrogen (grey baseline cost: $1.80/kg; SMR release: 9kg CO₂/kg).
            </p>

            <div style="display:flex; flex-direction:column; gap:10px; background:rgba(0,0,0,0.15); padding:10px 12px; border-radius:var(--r-md); border:1px solid var(--line);">
              <!-- Slider 1 -->
              <div style="display:flex; flex-direction:column; gap:2px;">
                <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-hi);">
                  <span>Baseline Green LCOH</span>
                  <span id="green-lcoh-lbl" style="font-weight:600; color:var(--cyan);">$5.00/kg</span>
                </div>
                <input type="range" id="calc-green-lcoh" min="1.5" max="8.0" step="0.1" value="5.0" style="accent-color:var(--cyan); cursor:pointer;" />
              </div>

              <!-- Slider 2 -->
              <div style="display:flex; flex-direction:column; gap:2px;">
                <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-hi);">
                  <span>Carbon Tax ($/t CO₂)</span>
                  <span id="carbon-tax-lbl" style="font-weight:600; color:var(--cyan);">$80/ton</span>
                </div>
                <input type="range" id="calc-carbon-tax" min="0" max="250" step="10" value="80" style="accent-color:var(--cyan); cursor:pointer;" />
              </div>

              <!-- Slider 3 -->
              <div style="display:flex; flex-direction:column; gap:2px;">
                <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--text-hi);">
                  <span>Production Subsidy / PTC</span>
                  <span id="prod-subsidy-lbl" style="font-weight:600; color:var(--cyan);">$3.00/kg</span>
                </div>
                <input type="range" id="calc-prod-subsidy" min="0.0" max="3.5" step="0.1" value="3.0" style="accent-color:var(--cyan); cursor:pointer;" />
              </div>
            </div>

            <!-- Comparison Table -->
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; font-size:11px; margin-top:4px;">
              <div style="background:var(--bg-1); border:1px solid var(--line); border-radius:4px; padding:8px;">
                <div style="color:var(--text-faint); font-weight:600; font-size:10.5px;">Taxed grey H₂ cost</div>
                <div style="font-size:14px; font-weight:700; color:var(--text-hi); margin-top:2px;">
                  <span id="sim-grey-total">$2.52</span> 
                  <span id="sim-grey-penalty" style="font-size:10px; color:var(--red); font-weight:500;">(+$0.72)</span>
                </div>
              </div>
              <div style="background:var(--bg-1); border:1px solid var(--line); border-radius:4px; padding:8px;">
                <div style="color:var(--text-faint); font-weight:600; font-size:10.5px;">Net green H₂ cost</div>
                <div id="sim-green-net" style="font-size:14px; font-weight:700; color:var(--cyan); margin-top:2px;">$2.00/kg</div>
              </div>
            </div>

            <!-- Verdict -->
            <div id="sim-policy-verdict" style="margin-top:2px;">
              <!-- Filled dynamically -->
            </div>
          </div>

          <!-- Regional Mandates summary tabs -->
          <div class="dashboard-card glass" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:12px;">
            <h3 style="font-size:14px; font-family:var(--font); color:var(--text-hi);">Global Mandates &amp; Targets</h3>
            
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
              <button class="mandate-btn tab-btn" data-target="us" style="text-align:left; font-size:11px; padding:8px 10px; margin:0;" onclick="selectRegionalTarget('us')">
                United States (IRA)
              </button>
              <button class="mandate-btn tab-btn" data-target="eu" style="text-align:left; font-size:11px; padding:8px 10px; margin:0;" onclick="selectRegionalTarget('eu')">
                European Union (RED)
              </button>
              <button class="mandate-btn tab-btn" data-target="germany" style="text-align:left; font-size:11px; padding:8px 10px; margin:0;" onclick="selectRegionalTarget('germany')">
                Germany (H2Global)
              </button>
              <button class="mandate-btn tab-btn" data-target="apac" style="text-align:left; font-size:11px; padding:8px 10px; margin:0;" onclick="selectRegionalTarget('apac')">
                APAC Import CfDs
              </button>
            </div>

            <style>
              .mandate-btn.tab-btn.active {
                color: var(--cyan) !important;
                border-color: rgba(63,214,232,0.4) !important;
                background: rgba(63,214,232,0.06) !important;
              }
            </style>

            <div id="mandate-details-container">
              <!-- Rendered dynamically -->
            </div>
          </div>

        </div>

      </div>

    </div>
  `;

  // Bind Simulator events
  document.getElementById("calc-green-lcoh").oninput = runPolicyCompetitivenessCalc;
  document.getElementById("calc-carbon-tax").oninput = runPolicyCompetitivenessCalc;
  document.getElementById("calc-prod-subsidy").oninput = runPolicyCompetitivenessCalc;
  runPolicyCompetitivenessCalc();

  // Bind mandate card tabs
  selectRegionalTarget("us");

  const select = document.getElementById("p-region-select");
  renderPolicyList(POLICY_SAMPLE_DATA, "all");
  document.getElementById("p-search").oninput = () => renderPolicyList(POLICY_SAMPLE_DATA, select.value);
  document.getElementById("p-impact-filter").onchange = () => renderPolicyList(POLICY_SAMPLE_DATA, select.value);
  select.onchange = () => renderPolicyList(POLICY_SAMPLE_DATA, select.value);

  animateCardsIn(el);
}
