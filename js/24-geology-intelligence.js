/* H2ELIOS geology intelligence
   Adds research context without presenting point locations as a subsurface
   suitability model. Authoritative references are deliberately kept close to
   every interpretation so project facts and general screening guidance remain
   distinguishable. */

const H2ELIOS_GEOLOGY_MEDIA = {
  salt: {
    name: "Salt cavern",
    maturity: "Commercial precedent",
    role: "High-cycle bulk storage",
    description: "Hydrogen is stored in a solution-mined cavity within halite. Low permeability and salt creep can support containment, while high injection and withdrawal rates suit balancing and dispatch.",
    checks: ["Cavern geometry and spacing", "Well and cement integrity", "Salt creep and subsidence", "Brine handling", "Delivered-gas purity"],
    sourceLabel: "U.S. DOE · Bulk storage",
    source: "https://www.energy.gov/cmei/fuels/site-and-bulk-hydrogen-storage"
  },
  depleted: {
    name: "Depleted reservoir",
    maturity: "Field validation",
    role: "Seasonal porous storage",
    description: "A previously producing oil or gas reservoir can offer large pore volume and existing characterization. Hydrogen behaviour, residual-gas mixing and legacy well integrity still require site-specific validation.",
    checks: ["Caprock containment", "Legacy well inventory", "Cushion gas", "Microbial and geochemical reactions", "Gas separation and purification"],
    sourceLabel: "U.S. DOE · SHASTA",
    source: "https://www.energy.gov/hgeo/articles/doe-three-year-us-underground-hydrogen-storage-assessment-expands-future"
  },
  aquifer: {
    name: "Saline aquifer",
    maturity: "Research / pilot",
    role: "Large seasonal pore volume",
    description: "Hydrogen occupies pore space in a saline formation. Unlike a depleted field, containment and injectivity must be demonstrated from dedicated geological and reservoir evidence.",
    checks: ["Trap and seal proof", "Injectivity and withdrawal", "Cushion-gas demand", "Microbial consumption", "Mineral reactions and impurities"],
    sourceLabel: "British Geological Survey",
    source: "https://www.bgs.ac.uk/news/making-the-case-for-underground-hydrogen-storage-in-the-uk/"
  },
  linedRock: {
    name: "Lined rock cavern",
    maturity: "Engineered demonstration",
    role: "Geology-flexible storage",
    description: "An excavated hard-rock cavity uses a pressure-resistant liner and the surrounding rock mass as an engineered containment system. It can extend storage beyond suitable salt basins.",
    checks: ["Rock-mass quality", "Liner fatigue and leakage", "Groundwater pressure", "Shaft and seal design", "Operating pressure envelope"],
    sourceLabel: "British Geological Survey",
    source: "https://www.bgs.ac.uk/news/making-the-case-for-underground-hydrogen-storage-in-the-uk/"
  },
  surface: {
    name: "Surface logistics",
    maturity: "Technology-specific",
    role: "Liquefaction, carrier or terminal",
    description: "This asset handles hydrogen above ground or through a chemical carrier. It belongs in the storage-and-logistics network, but it is not evidence of an underground storage formation.",
    checks: ["Carrier conversion losses", "Boil-off or reconversion", "Tank and terminal capacity", "Throughput versus inventory", "Product purity"],
    sourceLabel: "IEA · Trade and infrastructure",
    source: "https://www.iea.org/reports/global-hydrogen-review-2026/trade-and-infrastructure"
  },
  unclassified: {
    name: "Storage medium unclassified",
    maturity: "Insufficient metadata",
    role: "Requires source review",
    description: "The project record identifies a storage function but does not identify a geological formation or a surface storage format. H2ELIOS does not infer subsurface suitability from coordinates alone.",
    checks: ["Confirm storage medium", "Verify source date", "Separate inventory from throughput", "Locate formation boundary", "Review site investigation"],
    sourceLabel: "U.S. DOE · Bulk storage",
    source: "https://www.energy.gov/cmei/fuels/site-and-bulk-hydrogen-storage"
  }
};

function classifyStorageMedium(p) {
  const text = `${p.category || ""} ${p.subtype || ""} ${p.geology || ""}`.toLowerCase();
  if (/liquef|terminal|import|export|methylcyclohexane|lohc|ammonia|cracker/.test(text)) return "surface";
  if (/salt|halite/.test(text)) return "salt";
  if (/depleted|reservoir/.test(text)) return "depleted";
  if (/aquifer|porous/.test(text)) return "aquifer";
  if (/lined rock|hard rock|engineered cavern/.test(text)) return "linedRock";
  if (p.category === "storage" || p.category === "terminal") return "unclassified";
  return null;
}

function geologyLink(url, label) {
  return `<a href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(label)}</a>`;
}

function geologyDetailBlock(p) {
  const key = classifyStorageMedium(p);
  if (!key) return "";
  const medium = H2ELIOS_GEOLOGY_MEDIA[key];
  const projectContext = p.geology || medium.description;
  const evidence = p.evidence || (key === "surface" ? "Infrastructure classification" : "Medium inferred from project subtype");
  return `<section class="geology-detail" aria-label="Storage and geological context">
    <div class="stats-head">Storage &amp; geology</div>
    <div class="geology-medium-row">
      <div><span class="k">Medium</span><strong>${escapeHtml(medium.name)}</strong></div>
      <span class="geology-maturity">${escapeHtml(medium.maturity)}</span>
    </div>
    <p class="geology-project-context">${escapeHtml(projectContext)}</p>
    <div class="geology-evidence"><span>Evidence</span>${escapeHtml(evidence)}</div>
    <div class="geology-checks">${medium.checks.slice(0, 4).map((check) => `<span>${escapeHtml(check)}</span>`).join("")}</div>
    <div class="geology-source">Context: ${geologyLink(medium.source, medium.sourceLabel)}</div>
    <p class="geology-caveat">Screening context only. The mapped point does not include formation boundaries, reservoir simulation, well-integrity records or a site investigation.</p>
  </section>`;
}

function buildGeologyReferenceHTML() {
  const cards = ["salt", "depleted", "aquifer", "linedRock"].map((key) => {
    const medium = H2ELIOS_GEOLOGY_MEDIA[key];
    return `<article class="geology-reference-card">
      <div class="geology-card-head"><strong>${escapeHtml(medium.name)}</strong><span>${escapeHtml(medium.maturity)}</span></div>
      <small>${escapeHtml(medium.role)}</small>
      <p>${escapeHtml(medium.description)}</p>
      <details><summary>Site-screening checks</summary><ul>${medium.checks.map((check) => `<li>${escapeHtml(check)}</li>`).join("")}</ul></details>
      ${geologyLink(medium.source, medium.sourceLabel)}
    </article>`;
  }).join("");

  return `<div class="detail-kicker">Research reference · August 2026</div>
    <div class="detail-name" id="geology-panel-title">Geology intelligence</div>
    <p class="geology-lede">Underground hydrogen storage and naturally occurring hydrogen are different geological questions. H2ELIOS now labels the storage medium, evidence level and screening limits instead of treating every storage marker as equivalent.</p>
    <div class="geology-snapshot" aria-label="Infrastructure snapshot">
      <div><strong>11 TWh</strong><span>announced underground storage by 2035</span></div>
      <div><strong>~7%</strong><span>at FID or under construction</span></div>
      <div><strong>4</strong><span>storage archetypes reviewed</span></div>
    </div>
    <p class="geology-source geology-snapshot-source">Market snapshot: ${geologyLink("https://www.iea.org/reports/global-hydrogen-review-2026/trade-and-infrastructure", "IEA Global Hydrogen Review 2026")}</p>
    <div class="stats-head">Underground storage media</div>
    <div class="geology-reference-grid">${cards}</div>
    <div class="stats-head">Natural hydrogen prospectivity</div>
    <article class="geology-natural-card">
      <div class="geology-system-chain" aria-label="Natural hydrogen system"><span>Source</span><i>→</i><span>Migration</span><i>→</i><span>Reservoir</span><i>→</i><span>Seal</span></div>
      <p>USGS prospectivity requires the major components of a hydrogen system to occur together: sufficient generation, migration pathways, porous reservoir rock and a seal that preserves an accumulation. A prospective area is not a discovery or a recoverable-resource estimate.</p>
      ${geologyLink("https://www.usgs.gov/publications/prospectivity-mapping-geologic-hydrogen", "USGS Professional Paper 1900 · Prospectivity mapping")}
    </article>
    <p class="geology-panel-caveat"><strong>Map integrity:</strong> H2ELIOS does not draw a global prospectivity surface because the current dataset contains project coordinates, not harmonized geological polygons. Formation-scale layers should only be added from a citable GIS dataset with stated resolution, date and methodology.</p>`;
}

function openGeologyPanel() {
  closeOtherRightPanels("geology-panel");
  const panel = document.getElementById("geology-panel");
  const content = document.getElementById("geology-content");
  if (!panel || !content) return;
  content.innerHTML = buildGeologyReferenceHTML();
  panel.hidden = false;
}

function closeGeologyPanel() {
  const panel = document.getElementById("geology-panel");
  if (panel) panel.hidden = true;
}

function initGeologyIntelligence() {
  document.getElementById("geology-close")?.addEventListener("click", closeGeologyPanel);
}

window.H2GGeology = { media: H2ELIOS_GEOLOGY_MEDIA, classifyStorageMedium, open: openGeologyPanel };

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initGeologyIntelligence);
else initGeologyIntelligence();
