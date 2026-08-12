/* ==========================================================================
   H2Grid · Technology Tab Module
   Electrolyzer technology mix (derived), TRL catalogs, and Catalyst Cost Shock Simulators.
   ======================================================================= */

// Illustrative commodity price indices (Iridium $/oz, Nickel $/metric ton) -
// SAMPLE data, not a live feed. An earlier version faked a "Live: HH:MM:SS"
// timestamp against a non-existent api.h2grid.org endpoint (Math.random()
// jitter dressed up as real-time data) - same anti-pattern already fixed in
// the Market & Economics tab. Fixed here the same way: static values, no
// fake fetch, clearly badged.
const METALS_SAMPLE_DATA = {
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
let currentTechRegion = "all";
let metalsChartInstance = null;

// TRL band midpoint per technology, for positioning on the maturity
// spectrum below (SOEC/AEM are ranges in TECH_CATALOG - "TRL 6-7" etc -
// the spectrum needs one numeric x-position, so this is the midpoint of
// that range, not a separate claim).
const TECH_TRL_MID = { alk: 9, pem: 8, soec: 6.5, aem: 4.5 };
const TECH_COLORS = { alk: "#34d399", pem: "#60a5fa", soec: "#d99a3d", aem: "#f472b6" };

// Shared by the maturity spectrum (aggregate capacity per tech) and the
// constellation (per-project classification) so the two visualizations
// never disagree about what counts as PEM/ALK/SOEC/AEM.
function classifyTechKey(p) {
  const sub = String(p.subtype || "").toLowerCase();
  const name = String(p.name || "").toLowerCase();
  if (sub.includes("pem") || name.includes("pem")) return "PEM";
  if (sub.includes("alk") || sub.includes("alkaline") || name.includes("alkaline") || name.includes("alk")) return "ALK";
  if (sub.includes("soec") || sub.includes("solid oxide") || name.includes("solid oxide")) return "SOEC";
  if (sub.includes("aem") || sub.includes("anion exchange") || name.includes("aem")) return "AEM";
  return "Other";
}
function parseCapacityMw(capacityStr) {
  const c = String(capacityStr || "");
  let m = c.match(/([\d.]+)\s*GW/i);
  if (m) return parseFloat(m[1]) * 1000;
  m = c.match(/([\d.]+)\s*MW/i);
  return m ? parseFloat(m[1]) : 0;
}
function allTechFeatures() {
  const feats = [...D.production.features, ...D.manufacturing.features];
  if (window.IEA_DATA) feats.push(...window.IEA_DATA.features);
  return feats;
}
function techFeatureMatchesFilters(p, regionFilterLocal) {
  if (statusFilter !== "all" && p.statusClass !== statusFilter) return false;
  const activeRegion = regionFilterLocal !== "all" ? regionFilterLocal : regionFilter;
  if (activeRegion !== "all" && !(REGION_GROUPS[activeRegion] || []).includes(p.region)) return false;
  return true;
}

function computeTechnologyMix(regionFilterLocal = "all") {
  const counts = { PEM: 0, ALK: 0, SOEC: 0, AEM: 0, Other: 0 };
  const capacities = { PEM: 0, ALK: 0, SOEC: 0, AEM: 0, Other: 0 };

  allTechFeatures().forEach(f => {
    const p = f.properties;
    if (!techFeatureMatchesFilters(p, regionFilterLocal)) return;
    const tech = classifyTechKey(p);
    counts[tech]++;
    const cap = parseCapacityMw(p.capacity);
    if (cap > 0) capacities[tech] += cap;
  });

  return { counts, capacities };
}

// Technology constellation: every classified project is its own dot,
// grouped into one cluster per electrolyzer technology — replaces the old
// donut, which only ever showed an aggregate share and had no way to
// connect "PEM" back to any actual project. Dot size = that project's own
// capacity: dot opacity = source confidence (curated/IEA-exact vs.
// country-level approximate), so the cluster's overall haze already tells
// you how much of it is solid data before you click anything. Clicking a
// dot jumps to the Map with that project selected — the one deliberate
// cross-workspace link in this pass (real "universal selection context"
// threading every tab is a larger, separate piece of work).
const TECH_CLUSTER_ORDER = ["ALK", "PEM", "SOEC", "AEM", "Other"];
const TECH_CLUSTER_COLOR = { ALK: "#34d399", PEM: "#60a5fa", SOEC: "#d99a3d", AEM: "#f472b6", Other: "#67748c" };
const TECH_CLUSTER_LABEL = { ALK: "Alkaline", PEM: "PEM", SOEC: "Solid Oxide", AEM: "Anion Exchange", Other: "Unclassified" };
const MAX_CONSTELLATION_DOTS_PER_CLUSTER = 90;

function confidenceOpacity(p) {
  if (p.tier === "iea") return Number(p.approx) ? 0.28 : 0.85;
  if (p.tier === "api") return p.confidence != null && p.confidence < 1 ? 0.4 : 0.85;
  return 0.85; // curated (D.production/D.manufacturing) — highest-trust tier
}

function jumpToProjectOnMap(p, coords) {
  if (!Array.isArray(coords) || Number(p.approx)) return;
  window.beginMapHandoff?.({
    fromRoute: "technology",
    label: "Technology",
    selectionId: p.id || p.name,
    props: p,
    lngLat: coords
  });
}

function renderTechConstellation(regionFilterLocal = "all") {
  const el = document.getElementById("tech-constellation");
  if (!el) return;

  const byCluster = { ALK: [], PEM: [], SOEC: [], AEM: [], Other: [] };
  let totalClassified = 0, totalAll = 0;
  allTechFeatures().forEach((f) => {
    const p = f.properties;
    if (!techFeatureMatchesFilters(p, regionFilterLocal)) return;
    totalAll++;
    const key = classifyTechKey(p);
    if (key !== "Other") totalClassified++;
    byCluster[key].push({ p, coords: f.geometry && f.geometry.coordinates, cap: parseCapacityMw(p.capacity) });
  });

  const maxCap = Math.max(1, ...TECH_CLUSTER_ORDER.flatMap((k) => byCluster[k].map((d) => d.cap)));
  const W = 640, H = 300;
  const cols = TECH_CLUSTER_ORDER.length;
  const clusterW = W / cols;
  const clusterCy = 140, clusterRadius = clusterW * 0.42;

  const caption = document.getElementById("tech-mix-caption");
  if (caption) {
    const pct = totalAll > 0 ? Math.round((totalClassified / totalAll) * 100) : 0;
    caption.textContent = totalAll > 0
      ? `${totalClassified.toLocaleString()} of ${totalAll.toLocaleString()} tracked projects (${pct}%) disclose an electrolyzer technology — each dot below is one real project, sized by its capacity and dimmed if only approximately located.`
      : "No electrolyzer technology data available for this filter.";
  }

  const groups = TECH_CLUSTER_ORDER.map((key, ci) => {
    const cx = clusterW * ci + clusterW / 2;
    const color = TECH_CLUSTER_COLOR[key];
    let items = byCluster[key];
    const shown = items.length > MAX_CONSTELLATION_DOTS_PER_CLUSTER
      ? items.slice(0, MAX_CONSTELLATION_DOTS_PER_CLUSTER)
      : items;
    // Golden-angle phyllotaxis scatter: deterministic (no re-jitter on
    // re-render) and reads as an organic cluster rather than a grid.
    const dots = shown.map((d, i) => {
      const angle = i * 137.508 * (Math.PI / 180);
      const spread = clusterRadius * Math.sqrt(i / Math.max(1, shown.length));
      const x = cx + Math.cos(angle) * spread;
      const y = clusterCy + Math.sin(angle) * spread * 0.72;
      const r = 2 + Math.sqrt(d.cap / maxCap) * 8;
      const opacity = confidenceOpacity(d.p);
      const title = `${escapeHtml(d.p.name)} — ${escapeHtml(d.p.status || "")}${d.cap ? `, ${Math.round(d.cap).toLocaleString()} MW` : ""}`;
      return `<circle class="tech-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${color}" fill-opacity="${opacity}" data-idx="${i}"><title>${title}</title></circle>`;
    }).join("");
    const overflow = items.length > shown.length
      ? `<text x="${cx}" y="${clusterCy + clusterRadius * 0.72 + 22}" text-anchor="middle" font-size="9" fill="#67748c" font-family="Inter">+${items.length - shown.length} more</text>`
      : "";
    return {
      key, shown,
      markup: `<g class="tech-cluster" data-key="${key}">
        <circle cx="${cx}" cy="${clusterCy}" r="${clusterRadius + 10}" fill="none" stroke="${color}" stroke-opacity="0.12" stroke-width="1" stroke-dasharray="2 4"/>
        ${dots}
        ${overflow}
        <text x="${cx}" y="${H - 14}" text-anchor="middle" font-size="11" font-weight="700" fill="${color}" font-family="system-ui">${TECH_CLUSTER_LABEL[key]}</text>
        <text x="${cx}" y="${H - 2}" text-anchor="middle" font-size="9" fill="#67748c" font-family="var(--font-mono)">${items.length.toLocaleString()} project${items.length === 1 ? "" : "s"}</text>
      </g>`
    };
  });

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="tech-constellation-svg" role="img" aria-label="Electrolyzer technology constellation, one dot per project, click a dot to open it on the map">
    ${groups.map((g) => g.markup).join("")}
  </svg>`;

  groups.forEach((g) => {
    el.querySelectorAll(`.tech-cluster[data-key="${g.key}"] .tech-dot`).forEach((circle) => {
      const idx = Number(circle.dataset.idx);
      const d = g.shown[idx];
      if (!d) return;
      const hasPreciseGeography = Array.isArray(d.coords) && !Number(d.p.approx);
      circle.style.cursor = hasPreciseGeography ? "pointer" : "default";
      if (hasPreciseGeography) {
        circle.setAttribute("tabindex", "0");
        circle.setAttribute("role", "button");
        circle.setAttribute("aria-label", `Open ${d.p.name} on the map`);
        circle.addEventListener("click", () => jumpToProjectOnMap(d.p, d.coords));
        circle.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            jumpToProjectOnMap(d.p, d.coords);
          }
        });
      }
      // Drag source for the Calculator drop zone (js/09-router.js
      // wireCalculatorDropTarget) — only projects (which carry a real
      // capacity) are draggable; Companies-ecosystem nodes aren't, since
      // there's no capacity figure to prefill from a company record.
      // draggable has to be set as a DOM property here, not as a
      // "draggable=..." attribute in the SVG markup string above — SVG's
      // parser silently drops unrecognized attributes like HTML's global
      // draggable when the markup is written via innerHTML, so it has to
      // be assigned after the fact through the element's own property.
      circle.setAttribute("draggable", "true");
      circle.draggable = true;
      circle.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("application/json", JSON.stringify({ props: d.p, lngLat: d.coords }));
        e.dataTransfer.effectAllowed = "copy";
      });
    });
  });
}

// Maturity spectrum: ALK/PEM/SOEC/AEM positioned along a TRL 1-9 axis,
// node radius scaled by each technology's real deployed capacity (same
// computeTechnologyMix() the donut chart uses) - replaces a flat 4-button
// grid with something that actually shows relative maturity AND scale at a
// glance, in the spirit of IEA's own ETP Clean Energy Technology Guide
// (technologies-on-a-maturity-spectrum, click a node for detail).
function renderTrlSpectrum(regionFilterLocal = "all") {
  const el = document.getElementById("trl-spectrum");
  if (!el) return;

  const { capacities } = computeTechnologyMix(regionFilterLocal);
  const capKeyFor = { alk: "ALK", pem: "PEM", soec: "SOEC", aem: "AEM" };
  const techKeys = Object.keys(TECH_CATALOG);
  const maxCap = Math.max(1, ...techKeys.map((k) => capacities[capKeyFor[k]] || 0));

  const W = 640, H = 150, padX = 40, trackY = 58;
  const xAt = (trl) => padX + ((trl - 1) / 8) * (W - padX * 2);

  const bands = [
    { from: 1, to: 3, label: "Research" },
    { from: 3, to: 6, label: "Development" },
    { from: 6, to: 8, label: "Demonstration" },
    { from: 8, to: 9, label: "Deployment" }
  ];
  const bandMarkup = bands.map((b) => {
    const x1 = xAt(b.from), x2 = xAt(b.to);
    return `<rect x="${x1}" y="${trackY - 3}" width="${x2 - x1}" height="6" rx="3" fill="rgba(120,160,200,0.08)"/>
      <text x="${(x1 + x2) / 2}" y="${H - 10}" text-anchor="middle" font-size="9" fill="#67748c" font-family="Inter">${b.label}</text>`;
  }).join("");

  const tickMarkup = [1, 3, 6, 8, 9].map((t) =>
    `<text x="${xAt(t)}" y="${trackY - 16}" text-anchor="middle" font-size="8.5" fill="#67748c" font-family="var(--font-mono)">TRL ${t}</text>`
  ).join("");

  const nodeMarkup = techKeys.map((key) => {
    const trl = TECH_TRL_MID[key];
    const cap = capacities[capKeyFor[key]] || 0;
    const r = 9 + Math.sqrt(cap / maxCap) * 19;
    const x = xAt(trl);
    const color = TECH_COLORS[key];
    const isActive = key === selectedTechKey;
    const ring = isActive
      ? `<circle cx="${x}" cy="${trackY}" r="${r + 6}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.5"/>`
      : "";
    return `<g class="trl-node${isActive ? ' active' : ''}" data-tech="${key}">
      ${ring}
      <circle cx="${x}" cy="${trackY}" r="${r}" fill="${color}" fill-opacity="0.85" stroke="${isActive ? '#ffffff' : color}" stroke-width="${isActive ? 2 : 1}">
        <title>${escapeHtml(TECH_CATALOG[key].name)} — ${escapeHtml(TECH_CATALOG[key].trl)}${cap > 0 ? `, ${Math.round(cap).toLocaleString()} MW tracked` : ", no tracked capacity in view"}</title>
      </circle>
      <text x="${x}" y="${trackY + r + 15}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${isActive ? '#ffffff' : color}" font-family="system-ui">${key}</text>
    </g>`;
  }).join("");

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="trl-spectrum-svg" role="img" aria-label="Electrolyzer technology maturity spectrum, click a technology for detail">
    <line x1="${padX}" y1="${trackY}" x2="${W - padX}" y2="${trackY}" stroke="rgba(120,160,200,0.15)" stroke-width="1"/>
    ${bandMarkup}
    ${tickMarkup}
    ${nodeMarkup}
  </svg>`;

  el.querySelectorAll(".trl-node").forEach((g) => {
    g.style.cursor = "pointer";
    g.addEventListener("click", () => selectCatalogTech(g.dataset.tech));
  });
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
          labels: { color: '#b6c2d4', font: { family: 'system-ui', size: 9.5 } },
          position: 'top'
        }
      }
    }
  };

  if (metalsChartInstance) metalsChartInstance.destroy();
  metalsChartInstance = new Chart(ctx, chartConfig);
}

// 1. Interactive Technical Catalog: click a node on the TRL spectrum
function selectCatalogTech(key) {
  selectedTechKey = key;
  const d = TECH_CATALOG[key];
  if (!d) return;

  renderTrlSpectrum(currentTechRegion); // redraws with the new node highlighted

  const detailsContainer = document.getElementById("tech-catalog-details");
  if (detailsContainer) {
    detailsContainer.innerHTML = `
      <div style="background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-md); padding:14px; display:flex; flex-direction:column; gap:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h4 style="font-size:12.5px; font-family:var(--font); color:var(--text-hi); margin:0;">${escapeHtml(d.name)}</h4>
          <span style="font-size:10px; font-weight:700; color:var(--cyan); background:rgba(63,214,232,0.1); border:1px solid rgba(63,214,232,0.3); padding:2px 8px; border-radius:12px;">${escapeHtml(d.trl)}</span>
        </div>
        <dl style="display:grid; grid-template-columns:100px 1fr; gap:6px; font-size:11px; margin:0; line-height:1.4;">
          <dt style="color:var(--text-faint); font-weight:600; font-size:10.5px;">Operating temperature</dt>
          <dd style="color:var(--text-hi); font-weight:500; margin:0;">${escapeHtml(d.temp)}</dd>
          
          <dt style="color:var(--text-faint); font-weight:600; font-size:10.5px;">Energy need</dt>
          <dd style="color:var(--green-ok); font-weight:600; margin:0;">${escapeHtml(d.sec)}</dd>
          
          <dt style="color:var(--text-faint); font-weight:600; font-size:10.5px;">System CAPEX</dt>
          <dd style="color:var(--cyan); font-weight:600; margin:0;">${escapeHtml(d.capex)}</dd>
          
          <dt style="color:var(--text-faint); font-weight:600; font-size:10.5px;">Active catalysts</dt>
          <dd style="color:var(--text-muted); margin:0;">${escapeHtml(d.catalysts)}</dd>
        </dl>
        <div style="border-top:1px solid var(--line); padding-top:8px; font-size:10.5px; line-height:1.4; color:var(--text-muted);">
          <strong style="color:var(--text-hi); font-size:10.5px;">Critical engineering bottleneck:</strong>
          <div style="margin-top:2px;">${escapeHtml(d.bottlenecks)}</div>
        </div>
      </div>
    `;
    animateDetailIn(detailsContainer);
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
      </div>

      <!-- Main Visual Grid -->
      <div class="technology-main-grid" style="display:grid; grid-template-columns: 1.15fr 0.85fr; gap:16px;">
        
        <!-- Left Column: derived tech mix & interactive catalog -->
        <div style="display:flex; flex-direction:column; gap:16px;">
          
          <!-- Technology Constellation -->
          <div class="dashboard-card glass" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:10px;">
            <h3 style="font-size:14px; font-family:var(--font); color:var(--text-hi);">Electrolyzer Technology Mix</h3>
            <div id="tech-constellation" class="svg-viz-wrap"></div>
            <p id="tech-mix-caption" style="font-size:10.5px; color:var(--text-faint); line-height:1.4; margin:0;"></p>
          </div>

          <!-- Interactive Tech Catalog -->
          <div class="dashboard-card glass" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:12px;">
            <h3 style="font-size:14px; font-family:var(--font); color:var(--text-hi);">Electrolyzer Maturity Spectrum</h3>
            <p style="font-size:10.5px; color:var(--text-faint); line-height:1.4; margin:-6px 0 0;">Positioned by technology readiness level; node size scales with real tracked deployed capacity. Click a technology for detail.</p>

            <div id="trl-spectrum" class="svg-viz-wrap"></div>

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
            <h3 style="font-size:14px; font-family:var(--font); color:var(--text-hi);">Critical Materials Market Index <span class="badge badge-sample">Sample</span></h3>
            <div class="chart-wrapper" style="height: 180px; position:relative; background:rgba(0,0,0,0.15); border:1px solid var(--line); border-radius:var(--r-sm);">
              <canvas id="metals-chart"></canvas>
            </div>
            <p style="font-size:10.5px; color:var(--text-faint); line-height:1.4; margin:0;">Illustrative price trend, not a live commodity feed.</p>
          </div>

          <!-- Catalyst Cost Shock Simulator -->
          <div class="dashboard-card glass" style="padding:16px; margin:0; display:flex; flex-direction:column; gap:10px;">
            <h3 style="font-size:14px; font-family:var(--font); color:var(--text-hi);">PEM Catalyst Cost Shock Simulator</h3>
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
              <span id="sandbox-catalyst-val" style="font-size:24px; font-weight:700; color:var(--text-hi); font-family:var(--font); font-variant-numeric:tabular-nums;">$30/kW</span>
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
      currentTechRegion = regionSelect.value;
      renderTechConstellation(currentTechRegion);
      renderTrlSpectrum(currentTechRegion);
    };
  }

  // Bind Simulator sliders
  document.getElementById("calc-iridium-price").oninput = runCatalystCostCalc;
  document.getElementById("calc-platinum-price").oninput = runCatalystCostCalc;
  document.getElementById("calc-loading-density").oninput = runCatalystCostCalc;
  runCatalystCostCalc();

  // Render Derived Mix & Initial Tab details
  renderTechConstellation();
  selectCatalogTech("pem");
  renderMetalsChart(METALS_SAMPLE_DATA);

  animateCardsIn(el);
}
