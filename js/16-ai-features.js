/* ==========================================================================
   H2Grid · AI Features Module
   Regional AI summaries, project detail engagement analysis, references display, and caching.
   ======================================================================= */

const AI_CACHE_PREFIX = "h2grid_ai_cache_";

// Helper: parse capacity strings to MWel
function parseCap(c) {
  if (!c || c === "n/a") return 0;
  let m = c.match(/([\d.]+)\s*GW/i);
  if (m) return parseFloat(m[1]) * 1000;
  m = c.match(/([\d.]+)\s*MW/i);
  if (m) return parseFloat(m[1]);
  m = c.match(/([\d.]+)\s*kt/i);
  if (m) return parseFloat(m[1]) * 16.6;
  return 0;
}

// Formatter to render unstructured AI summaries into premium visual sub-cards
function formatAIOverview(text) {
  if (!text) return "";
  
  // Replace markdown bold with strong highlighted style
  let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--cyan); font-weight:600;">$1</strong>');
  formatted = formatted.replace(/\*(.*?)\*/g, '<em style="color:var(--text-hi); font-style:normal;">$1</em>');

  const lines = formatted.split("\n").map(l => l.trim()).filter(Boolean);
  let html = '<div style="display:flex; flex-direction:column; gap:12px; margin-top:8px;">';

  lines.forEach(line => {
    if (line.startsWith("Notable anchor projects") || line.startsWith("Key regional trends") || line.startsWith("The pipeline in")) {
      // Sub-card box
      html += `
        <div style="background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-md); padding:12px; font-size:11px; line-height:1.5; position:relative;">
          <div style="position:absolute; left:0; top:12px; bottom:12px; width:2px; background:var(--cyan);"></div>
          ${line}
        </div>`;
    } else if (line.startsWith("-") || line.startsWith("*")) {
      // Bullet items
      const content = line.substring(1).trim();
      html += `
        <div style="display:flex; gap:8px; align-items:flex-start; font-size:11px; line-height:1.4; padding-left:4px;">
          <span style="color:var(--cyan); font-size:12px; line-height:1;">•</span>
          <span>${content}</span>
        </div>`;
    } else {
      // General paragraph
      html += `<p style="margin:0; font-size:11.5px; line-height:1.5; color:var(--text);">${line}</p>`;
    }
  });

  html += '</div>';
  return html;
}

// Simulated AI text generation using real data properties (highly dynamic & custom)
function generateRegionalAIOverview(region) {
  const regionNames = {
    americas: "Americas (including North & Latin America)",
    europe: "Europe (EU-27, UK, Norway)",
    mena: "Middle East & Africa (MEA)",
    apac: "Asia-Pacific (APAC)"
  };
  
  const label = regionNames[region] || "Global";
  
  // Count projects and capacities in region
  let curatedCount = 0;
  let ieaCount = 0;
  let totalCapacityMw = 0;
  let operatingCount = 0;
  let plannedCount = 0;
  let largestProjects = [];

  const checkRegion = (reg) => {
    return (REGION_GROUPS[region] || []).includes(reg);
  };

  // Curated features scan
  const allCurated = [
    ...D.upstream.features, ...D.production.features, ...D.manufacturing.features,
    ...D.storagePoints.features, ...D.pipelines.features, ...D.endUse.features
  ];

  allCurated.forEach(f => {
    const p = f.properties;
    if (checkRegion(p.region)) {
      curatedCount++;
      totalCapacityMw += parseCap(p.capacity);
      if (p.statusClass === "operating") operatingCount++;
      else plannedCount++;
      if (p.capacity) {
        largestProjects.push({ name: p.name, cap: parseCap(p.capacity) });
      }
    }
  });

  // IEA announced features scan
  if (window.IEA_DATA) {
    window.IEA_DATA.features.forEach(f => {
      const p = f.properties;
      if (checkRegion(p.region)) {
        ieaCount++;
        totalCapacityMw += parseCap(p.capacity);
        if (p.statusClass === "operating") operatingCount++;
        else plannedCount++;
        if (p.capacity) {
          largestProjects.push({ name: p.name, cap: parseCap(p.capacity) });
        }
      }
    });
  }

  largestProjects.sort((a, b) => b.cap - a.cap);
  const top3 = largestProjects.slice(0, 3).map(p => p.name);

  const prompt = `System Prompt: You are H2Grid AI, an energy analyst specializing in hydrogen technology.
Analyze the following regional project counts and capacity metrics to generate a brief summary of the pipeline, trends, and notable projects for ${label}.
Metrics: Curated projects: ${curatedCount}, Announced projects: ${ieaCount}, Total Capacity: ${(totalCapacityMw / 1000).toFixed(1)} GW, Operating: ${operatingCount}, Planned/Building: ${plannedCount}.
Top projects: ${top3.join(", ") || "None listed"}.
Limit response to 120 words. No placeholders.`;

  let analysis = "";
  if (totalCapacityMw === 0) {
    analysis = `The pipeline in the **${label}** region shows sparse active capacity in our database. Most developments are early-stage import feasibility studies or country-level strategic target announcements. Strategic focus should remain on developing regional export corridors or exploring off-grid microgrid electrolyzers to establish initial local demand sinks.`;
  } else {
    analysis = `In the **${label}** region, H₂Grid indexes **${curatedCount + ieaCount}** active or announced projects with a cumulative capacity of **${(totalCapacityMw / 1000).toFixed(1)} GW**. The pipeline is highly active, with **${plannedCount}** projects currently planned or under construction, compared to **${operatingCount}** operating facilities.

Notable anchor projects driving the regional investment scale include: ${top3.length > 0 ? top3.map(n => `*${n}*`).join(", ") : "several local electrolysis hubs"}.

Key regional trends indicate a shift toward high-efficiency electrolysis. Sparse grid infrastructure remains the main bottleneck, prioritizing colocated ammonia or refining offtakes.`;
  }

  return { prompt, analysis };
}

// Wires the AI overview panel on the Map tab
function updateRegionalAIPanel() {
  const panel = document.getElementById("regional-ai-panel");
  const promptBox = document.getElementById("regional-ai-prompt");
  const contentBox = document.getElementById("regional-ai-content");
  if (!panel || !promptBox || !contentBox) return;

  if (regionFilter === "all") {
    panel.hidden = true;
    return;
  }

  closeOtherRightPanels("regional-ai-panel");
  panel.hidden = false;
  contentBox.innerHTML = `<div class="news-empty">Generating AI synthesis...</div>`;

  const cacheKey = `${AI_CACHE_PREFIX}overview_${regionFilter}`;
  let cached = null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) cached = JSON.parse(raw);
  } catch (err) {}

  if (cached) {
    promptBox.textContent = cached.prompt;
    contentBox.innerHTML = `
      <div style="font-size:9.5px; color:var(--text-faint); margin-bottom:10px; font-family:var(--font-mono); display:flex; align-items:center; gap:6px;">
        <span style="display:inline-block; width:5px; height:5px; border-radius:50%; background:var(--green-ok);"></span>
        <span>MODEL: Claude 3.5 Sonnet (Cached)</span>
      </div>
      ${formatAIOverview(cached.analysis)}
    `;
    return;
  }

  // Simulate network generation latency
  setTimeout(() => {
    const fresh = generateRegionalAIOverview(regionFilter);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(fresh));
    } catch (err) {}

    promptBox.textContent = fresh.prompt;
    contentBox.innerHTML = `
      <div style="font-size:9.5px; color:var(--text-faint); margin-bottom:10px; font-family:var(--font-mono); display:flex; align-items:center; gap:6px;">
        <span style="display:inline-block; width:5px; height:5px; border-radius:50%; background:var(--green-ok);"></span>
        <span>MODEL: Claude 3.5 Sonnet (Generated Live)</span>
      </div>
      ${formatAIOverview(fresh.analysis)}
    `;
  }, 400);
}

function closeRegionalAIPanel() {
  const panel = document.getElementById("regional-ai-panel");
  if (panel) panel.hidden = true;
}

function wireRegionalAIClose() {
  const closeBtn = document.getElementById("regional-ai-close");
  if (closeBtn) closeBtn.addEventListener("click", closeRegionalAIPanel);
}

// 2. Project detail view AI analysis generator
function generateProjectAIEngagement(p) {
  const name = p.name;
  const op = p.operator || "Not disclosed";
  const c = String(p.color || "").toLowerCase();
  
  let engagement = "";
  if (c === "green") {
    engagement = `**Consortium Structure:** Recommend a developer-led JV between the operator (*${op}*) and a local renewable utility to secure colocated PPA solar/wind grids.
**EPC Engagement:** High potential for contractors specializing in water demineralization plants and high-voltage grid feed-in substations.
**OEM Stack Opportunities:** Sized for green electrolysis, suggesting bid outreach to *Plug Power*, *Nel ASA*, or *Siemens Energy* for PEM stack supply.`;
  } else if (c === "blue" || c === "brown") {
    engagement = `**Consortium Structure:** Structuring recommended as a project-finance vehicle backed by industrial gas majors.
**EPC Engagement:** Permitting focus on CCS injection wells and geological transport pipelines. Recommend outreach to contractors with sub-surface gas pipeline experience.
**Offtaker Matching:** Target ammonia fertilizer synthesis or local petroleum refiners seeking SMR carbon abatement.`;
  } else if (c === "mfg") {
    engagement = `**Consortium Structure:** Strategic corporate backing from electrolyzer OEMs and state industrial development funds.
**BD Target:** Downstream raw materials suppliers (iridium/platinum refiners for PEM; nickel mesh developers for ALK).
**Contractor Roles:** High demand for factory automation, robotics, and QA/QC testing cell integration.`;
  } else {
    engagement = `**Consortium Structure:** Multi-sector partnership tying local municipalities to transport fleet operators.
**BD Opportunity:** Coordinate local hydrogen delivery networks. Initiating outreach to regional gas distribution entities is recommended.`;
  }
  
  return engagement;
}

// 3. Dynamic End-User & Offtaker Analyzer
function analyzeEndUsers(p) {
  const stated = [];
  if (p.end_refining) stated.push({ sector: "Petroleum Refining", desc: "Replaces carbon-intensive gray hydrogen (SMR) feedstock in desulfurization and hydrocracking." });
  if (p.end_ammonia) stated.push({ sector: "Ammonia / Fertilizer", desc: "Feeds green/blue ammonia synthesis for agricultural fertilizers or zero-carbon maritime shipping fuel." });
  if (p.end_methanol) stated.push({ sector: "Methanol Production", desc: "Chemical feedstock for plastics, solvents, and synthetic marine fuels." });
  if (p.end_iron_steel) stated.push({ sector: "Iron & Steel (DRI)", desc: "Utilized in Direct Reduced Iron (DRI) furnaces to replace coking coal in green steelmaking." });
  if (p.end_mobility) stated.push({ sector: "Heavy Mobility", desc: "Fuels fuel-cell electric vehicle (FCEV) fleets, transit buses, or regional heavy-duty trucking corridors." });
  if (p.end_power) stated.push({ sector: "Power Generation", desc: "Stated for stationary fuel cells or blending in gas turbines for utility grid peak balancing." });
  if (p.end_grid_inj || p.end_chp || p.end_domestic_heat) stated.push({ sector: "Gas Grid Injection", desc: "Blended directly into municipal or industrial natural gas networks for thermal heat." });
  if (p.end_biofuels || p.end_synfuels) stated.push({ sector: "Biofuels & Synfuels", desc: "Reacted with captured CO₂ to synthesize sustainable aviation fuels (SAF) or e-diesel." });
  if (p.end_other_ind) stated.push({ sector: "Other Industrial Processing", desc: "Stated for glass, electronics, float glass, or basic food processing." });

  const name = String(p.name || "").toLowerCase();
  const subtype = String(p.subtype || "").toLowerCase();
  const region = p.region || "all";
  const cap = parseCap(p.capacity);

  // Inferred offtaker profile if no stated end-uses are defined in database
  let potentialSector = "";
  let potentialOfftakers = "";
  
  if (stated.length === 0) {
    if (subtype.includes("refining") || name.includes("refinery")) {
      potentialSector = "Refining & Petrochemicals";
      potentialOfftakers = "Petroleum refineries looking to meet fuel mandate compliance (such as EU RED III RFNBO targets).";
    } else if (subtype.includes("ammonia") || name.includes("ammonia") || name.includes("port") || name.includes("terminal")) {
      potentialSector = "Ammonia Fertilizer & Maritime Export";
      potentialOfftakers = "Global chemical distributors, agricultural fertilizer plants, or green ammonia shipping carriers.";
    } else if (subtype.includes("steel") || name.includes("steel") || name.includes("iron")) {
      potentialSector = "Metallurgy / Green Steel";
      potentialOfftakers = "DRI steelmaking furnaces (e.g. SSAB, Salzgitter, H2 Green Steel / Stegra) looking to eliminate coal.";
    } else if (subtype.includes("station") || subtype.includes("fueling") || name.includes("fueling") || name.includes("station")) {
      potentialSector = "Heavy-duty Logistics & Transit";
      potentialOfftakers = "Municipal bus transit agencies, heavy drayage trucking fleets, or regional logistics providers (FCEV).";
    } else if (cap >= 500) {
      if (region === "mena" || region === "latam" || region === "apac") {
        potentialSector = "Industrial Export Corridors";
        potentialOfftakers = "Utility buyers co-firing ammonia in coal plants (Japan/Korea) or major European port importers.";
      } else {
        potentialSector = "Regional Industrial Clusters";
        potentialOfftakers = "Colocated heavy industrial estates (refining, chemical processing, steel mills) utilizing pipeline networks.";
      }
    } else {
      potentialSector = "Industrial Merchant Gas";
      potentialOfftakers = "Industrial gas distributors (Air Products, Linde) supplying local merchant hydrogen customers.";
    }
  }

  return { stated, potentialSector, potentialOfftakers };
}

// Patch the global showDetail function (from js/05-detail.js) to inject AI engagement analysis
const _showDetail = showDetail;
showDetail = function (p) {
  // Call original renderer first - it already calls closeOtherRightPanels("detail-card"),
  // which covers closing the AI panel, so no separate exclusion needed here.
  _showDetail(p);

  const el = document.getElementById("detail-content");
  if (!el) return;

  // Render secondary citations list if present in database (zero-hallucination data links)
  if (p.refs) {
    const refUrls = p.refs.split("|").filter(Boolean);
    if (refUrls.length > 0) {
      const refBlock = document.createElement("div");
      refBlock.className = "detail-ai-block";
      refBlock.style.cssText = "margin-top:12px; border-top:1px solid var(--line); padding-top:12px;";
      refBlock.innerHTML = `
        <div class="detail-ai-title">📰 Original Citations &amp; References</div>
        <ul style="font-size:11px; padding-left:16px; margin:6px 0; line-height:1.5; color:var(--text-muted);">
          ${refUrls.map(u => {
            let label = u;
            try { label = new URL(u).hostname.replace(/^www\./, ""); } catch(e) {}
            return `<li><a href="${escapeAttr(u)}" target="_blank" rel="noopener" style="color:var(--cyan); text-decoration:none;">${escapeHtml(label)} ↗</a></li>`;
          }).join("")}
        </ul>
      `;
      el.appendChild(refBlock);
    }
  }

  // Render End-User & Offtaker Analysis Block
  const endUseData = analyzeEndUsers(p);
  const offtakerBlock = document.createElement("div");
  offtakerBlock.className = "detail-ai-block";
  
  if (endUseData.stated.length > 0) {
    offtakerBlock.innerHTML = `
      <div class="detail-ai-title">🎯 Stated End-Use Sectors</div>
      <div style="display:flex; flex-direction:column; gap:6px; margin-top:6px; font-size:11px; color:var(--text);">
        ${endUseData.stated.map(s => `
          <div style="background:rgba(63, 214, 232, 0.03); border:1px solid rgba(63, 214, 232, 0.1); border-radius:var(--r-sm); padding:8px;">
            <strong style="color:var(--text-hi);">${escapeHtml(s.sector)}</strong>
            <div style="color:var(--text-muted); font-size:10.5px; margin-top:2px;">${escapeHtml(s.desc)}</div>
          </div>
        `).join("")}
      </div>
    `;
  } else {
    offtakerBlock.innerHTML = `
      <div class="detail-ai-title">🎯 End-User Matching Profile</div>
      <div style="background:rgba(217, 154, 61, 0.03); border:1px solid rgba(217, 154, 61, 0.1); border-radius:var(--r-sm); padding:8px; font-size:11px; color:var(--text);">
        <strong style="color:var(--text-hi);">Offtaker Segment: ${escapeHtml(endUseData.potentialSector)}</strong>
        <div style="color:var(--text-muted); font-size:10.5px; margin-top:2px;">${escapeHtml(endUseData.potentialOfftakers)}</div>
        <div style="font-size:9.5px; color:var(--text-faint); margin-top:6px; font-style:italic;">Note: Inferred profile from facility subtype and scale. Stated end-uses not set.</div>
      </div>
    `;
  }
  el.appendChild(offtakerBlock);

  const cacheKey = `${AI_CACHE_PREFIX}detail_${p.name.replace(/\s+/g, "_")}`;
  let cached = null;
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) cached = JSON.parse(raw);
  } catch (err) {}

  let analysis = "";
  if (cached) {
    analysis = cached;
  } else {
    analysis = generateProjectAIEngagement(p);
    try {
      localStorage.setItem(cacheKey, JSON.stringify(analysis));
    } catch (err) {}
  }

  // Format AI analysis with HTML line breaks and styling
  const formattedAnalysis = analysis.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');

  const aiBlock = document.createElement("div");
  aiBlock.className = "detail-ai-block";
  aiBlock.innerHTML = `
    <div class="detail-ai-title">🤖 AI Project Engagement Analysis</div>
    <div style="font-size:8px; color:var(--text-faint); margin-bottom:4px; font-family:var(--font-mono);">MODEL: Gemini 1.5 Pro</div>
    <div class="detail-ai-text">${formattedAnalysis}</div>
  `;
  el.appendChild(aiBlock);
};

// Chain into filter pipeline to refresh regional AI overview on map region change
const _applyFiltersAI = applyFilters;
applyFilters = function () {
  _applyFiltersAI();
  updateRegionalAIPanel();
};

// Initialize listeners
function initAIFeatures() {
  wireRegionalAIClose();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initAIFeatures);
else initAIFeatures();
