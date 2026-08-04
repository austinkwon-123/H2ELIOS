/* ==========================================================================
   H2Grid · Companies & Partners Tab Module
   Searchable companies database and Local Partner/BD Connector.
   ======================================================================= */

// The companies list below names real organizations (real names/URLs).
// The "partners" directory is a different thing entirely: every firm in it
// ("Delaware H₂ Counselors", "Nordic Flow Contractors", etc.) is invented -
// there is no such registered entity. The template used to call them
// "vetted, legally registered local contractors" and offer an "Initiate
// Outreach" button that fires a real-looking confirmation, which would
// mislead a user into thinking they'd contacted a real business. Fixed
// below: honest copy, a SAMPLE badge, and the button relabeled as a
// preview, not an action. Also drops the fake api.h2grid.org "Live" fetch,
// same as the other tabs.
const COMPANIES_SAMPLE_DATA = {
  companies: [
    { name: "Plug Power", country: "USA", segment: "Electrolyzer OEM", url: "https://www.plugpower.com" },
    { name: "thyssenkrupp nucera", country: "DEU", segment: "Electrolyzer OEM", url: "https://www.thyssenkrupp-nucera.com" },
    { name: "Nel ASA", country: "NOR", segment: "Electrolyzer OEM", url: "https://nelhydrogen.com" },
    { name: "ITM Power", country: "GBR", segment: "Electrolyzer OEM", url: "https://itm-power.com" },
    { name: "Bloom Energy", country: "USA", segment: "Electrolyzer OEM", url: "https://www.bloomenergy.com" },
    { name: "Air Products", country: "USA", segment: "Industrial Gas Major", url: "https://www.airproducts.com" },
    { name: "Linde", country: "DEU", segment: "Industrial Gas Major", url: "https://www.linde.com" },
    { name: "Air Liquide", country: "FRA", segment: "Industrial Gas Major", url: "https://www.airliquide.com" },
    { name: "Stegra (H2 Green Steel)", country: "SWE", segment: "Offtaker", url: "https://stegra.com" },
    { name: "RWE", country: "DEU", segment: "Project Developer", url: "https://www.rwe.com" },
    { name: "Acwa Power", country: "SAU", segment: "Project Developer", url: "https://www.acwapower.com" },
    { name: "John Wood Group", country: "GBR", segment: "EPC/Contractor", url: "https://www.woodgroup.com" }
  ],
  partners: {
    USA: [
      { name: "Apex Clean Energy (Local EPC)", type: "Contractor", contact: "us-epc@apexcleanenergy.com", desc: "Specializes in gigawatt-scale wind/solar integration for green hydrogen electrolysis facilities in the Midwest." },
      { name: "Delaware H₂ Counselors", type: "Legal / Advisor", contact: "legal@deh2counselors.com", desc: "Corporate structuring, NEPA environmental permitting, and federal Clean Hydrogen tax credit tax equity advisory." }
    ],
    DEU: [
      { name: "H2-Projektbau GmbH", type: "EPC / Coordinator", contact: "h2pb@h2projektbau.de", desc: "German grid-interconnection specialist and EPC coordinator for hydrogen blending and pipeline injection loops." },
      { name: "Berlin Energy Economists", type: "Advisory", contact: "policy-advisory@beecon.de", desc: "Regulatory consultants specializing in EU RED III RFNBO compliance audits and local grid feed-in tariffs." }
    ],
    NOR: [
      { name: "Nordic Flow Contractors", type: "Contractor", contact: "flow@nordicflow.no", desc: "Specialized contractors for high-pressure cryogenic liquid hydrogen maritime loading terminals and storage safety systems." }
    ],
    SAU: [
      { name: "Riyadh H₂ Partners", type: "Local Representative", contact: "outreach@riyadh-h2.com.sa", desc: "Sovereign wealth fund coordination and joint-venture facilitation for green ammonia export mega-projects." }
    ],
    OTH: [
      { name: "Universal H₂ Consulting", type: "Advisory / Broker", contact: "global@universal-h2.com", desc: "Cross-border offtake agreement negotiations, corporate PPA structures, and global project development advisory." }
    ]
  }
};

// Ecosystem view: companies as nodes grouped by segment, the same visual
// language as the Technology constellation (js/12-technology.js) — one
// system, applied twice. Clicking a node filters the registry table below
// it rather than opening a separate detail surface, since a company here
// only has the fields the table already shows (name/country/segment/url);
// inventing a bigger node-click payload would mean fabricating data that
// doesn't exist. Node size is uniform on purpose — there is no real
// "project involvement" metric in this dataset, and faking one to vary dot
// size would be exactly the kind of unearned specificity worth avoiding.
const COMPANY_SEGMENT_COLOR = {
  "Electrolyzer OEM": "#60a5fa",
  "Industrial Gas Major": "#d99a3d",
  "Project Developer": "#34d399",
  "Offtaker": "#f472b6",
  "EPC/Contractor": "#a78bfa"
};
const COMPANY_SEGMENT_ORDER = ["Electrolyzer OEM", "Project Developer", "Industrial Gas Major", "Offtaker", "EPC/Contractor"];

function renderCompanyEcosystem(data) {
  const el = document.getElementById("company-ecosystem");
  if (!el) return;

  const bySegment = {};
  COMPANY_SEGMENT_ORDER.forEach((s) => (bySegment[s] = []));
  data.companies.forEach((c) => { (bySegment[c.segment] = bySegment[c.segment] || []).push(c); });
  const segments = COMPANY_SEGMENT_ORDER.filter((s) => bySegment[s] && bySegment[s].length);

  const W = 640, H = 190;
  const clusterW = W / segments.length;
  const cy = 90, maxR = clusterW * 0.36;

  const groups = segments.map((seg, ci) => {
    const cx = clusterW * ci + clusterW / 2;
    const color = COMPANY_SEGMENT_COLOR[seg] || "#67748c";
    const companies = bySegment[seg];
    const nodes = companies.map((c, i) => {
      const angle = i * 137.508 * (Math.PI / 180);
      const spread = maxR * Math.sqrt(i / Math.max(1, companies.length));
      const x = cx + Math.cos(angle) * spread;
      const y = cy + Math.sin(angle) * spread * 0.7;
      return `<circle class="company-node" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="${color}" fill-opacity="0.85" data-idx="${i}"><title>${escapeHtml(c.name)} — ${escapeHtml(c.country)}</title></circle>`;
    }).join("");
    return {
      seg, companies,
      markup: `<g class="company-cluster" data-seg="${escapeAttr(seg)}">
        <circle cx="${cx}" cy="${cy}" r="${maxR + 12}" fill="none" stroke="${color}" stroke-opacity="0.12" stroke-width="1" stroke-dasharray="2 4"/>
        ${nodes}
        <text x="${cx}" y="${H - 6}" text-anchor="middle" font-size="10.5" font-weight="700" fill="${color}" font-family="Space Grotesk">${escapeHtml(seg)}</text>
      </g>`
    };
  });

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="company-ecosystem-svg" role="img" aria-label="Hydrogen company ecosystem, grouped by segment, click a node to find it in the registry below">
    ${groups.map((g) => g.markup).join("")}
  </svg>`;

  groups.forEach((g) => {
    el.querySelectorAll(`.company-cluster[data-seg="${CSS.escape(g.seg)}"] .company-node`).forEach((circle) => {
      const c = g.companies[Number(circle.dataset.idx)];
      if (!c) return;
      circle.style.cursor = "pointer";
      circle.addEventListener("click", () => {
        const search = document.getElementById("c-search-input");
        search.value = c.name;
        renderCompaniesTable(data);
        document.getElementById("companies-table-body").scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  });
}

function renderCompaniesTable(data) {
  const tbody = document.getElementById("companies-table-body");
  if (!tbody) return;

  const searchQuery = document.getElementById("c-search-input").value.toLowerCase();
  const segmentQuery = document.getElementById("c-segment-select").value;

  const filtered = data.companies.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery) || c.country.toLowerCase().includes(searchQuery);
    const matchesSegment = segmentQuery === "all" || c.segment === segmentQuery;
    return matchesSearch && matchesSegment;
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:var(--text-muted); padding:20px;">No companies match the filters.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => `
    <tr>
      <td style="font-weight:600; color:var(--text-hi);">${escapeHtml(c.name)}</td>
      <td><span class="pill" style="font-family:var(--font-mono); font-size:10px;">${escapeHtml(c.country)}</span></td>
      <td><span style="color:var(--cyan); font-size:11.5px;">${escapeHtml(c.segment)}</span></td>
      <td><a href="${escapeAttr(c.url)}" target="_blank" rel="noopener">Visit Site ↗</a></td>
    </tr>
  `).join("");
}

function renderPartnerBDConnector(data) {
  const country = document.getElementById("p-country-select").value;
  const container = document.getElementById("partner-list-container");
  if (!container) return;

  const list = data.partners[country] || data.partners.OTH;

  container.innerHTML = list.map(p => `
    <div style="background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-md); padding:14px; display:flex; flex-direction:column; gap:8px;">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
        <h4 style="font-family:var(--font-head); font-size:12.5px; color:var(--text-hi); margin:0;">${p.name}</h4>
        <span style="font-size:9.5px; font-weight:600; padding:1px 5px; border-radius:4px; background:rgba(63,214,232,0.1); color:var(--cyan);">${p.type}</span>
      </div>
      <p style="font-size:11.5px; color:var(--text); line-height:1.4; margin:0;">${p.desc}</p>
      <button class="tab-btn" onclick="initiatePartnerOutreach('${p.name}', '${p.contact}')" style="align-self:flex-start; margin-top:4px; font-size:10px; padding:4px 8px; background:var(--cyan-dim); color:var(--cyan); border:1px solid var(--line-accent); box-shadow:none;">
        ✉ Preview Outreach Template
      </button>
    </div>
  `).join("");

  // Multiple sibling cards here (one per partner), not the single-wrapper
  // shape animateDetailIn expects - stagger each directly, same motion as
  // a deliberate, infrequent action (destination country changed).
  Array.from(container.children).forEach((card, i) => {
    card.classList.add("tab-detail-in");
    card.style.animationDelay = `${i * 60}ms`;
  });
}

window.initiatePartnerOutreach = function(name, email) {
  alert(`This is a SAMPLE profile, not a real registered business - "${name}" and its contact address (${email}) are illustrative only.\n\nIn a version wired to a real partner directory, this would open an outreach draft to a verified contact.`);
};

function initCompaniesPage() {
  const el = document.getElementById("page-companies");
  if (!el) return;

  el.innerHTML = `
    <div class="page-container">
      <div class="page-header">
        <h2>Companies &amp; Partners</h2>
        <p>Maintainable registry of global hydrogen developers and contractors, with a localized business development recommender.</p>
      </div>

      <div class="dashboard-grid two-cols">
        <!-- Left: Searchable Companies Database -->
        <div class="dashboard-card" style="min-height: 480px;">
          <h3>Hydrogen Companies Registry</h3>
          <div id="company-ecosystem" class="svg-viz-wrap" style="margin-bottom:12px;"></div>

          <div class="search-filter-row" style="margin-bottom:8px;">
            <input type="text" id="c-search-input" class="search-input" placeholder="Search by name or country..." />
            <select id="c-segment-select">
              <option value="all">Segment: All</option>
              <option value="Electrolyzer OEM">OEM (Electrolyzers)</option>
              <option value="Industrial Gas Major">Industrial Gas Major</option>
              <option value="Project Developer">Project Developer</option>
              <option value="Offtaker">Offtaker / Consumers</option>
              <option value="EPC/Contractor">EPC / Contractor</option>
            </select>
          </div>

          <div class="data-table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Company Name</th>
                  <th>Country</th>
                  <th>Segment</th>
                  <th>Links</th>
                </tr>
              </thead>
              <tbody id="companies-table-body">
                <!-- Rendered dynamically -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- Right: Partner BD Connector -->
        <div class="dashboard-card" style="min-height: 480px;">
          <h3>Local Partner / BD Connector <span class="badge badge-sample">SAMPLE</span></h3>
          <p style="font-size:11.5px; color:var(--text-muted); margin:0;">
            Illustrative example profiles of the kind of local contractor/advisor a real directory would surface by destination country — none of the firms below are real registered businesses.
          </p>

          <div class="search-filter-row" style="margin-bottom:8px;">
            <label for="p-country-select" style="font-size:11px; align-self:center; color:var(--text-muted);">Destination Country:</label>
            <select id="p-country-select" style="flex-grow:1;">
              <option value="USA">United States (USA)</option>
              <option value="DEU">Germany (DEU)</option>
              <option value="NOR">Norway (NOR)</option>
              <option value="SAU">Saudi Arabia (SAU)</option>
              <option value="OTH">Other / Global Markets</option>
            </select>
          </div>

          <div id="partner-list-container" style="display:flex; flex-direction:column; gap:12px;">
            <!-- Rendered dynamically -->
          </div>
        </div>
      </div>
    </div>
  `;

  renderCompanyEcosystem(COMPANIES_SAMPLE_DATA);
  renderCompaniesTable(COMPANIES_SAMPLE_DATA);
  renderPartnerBDConnector(COMPANIES_SAMPLE_DATA);

  document.getElementById("c-search-input").oninput = () => renderCompaniesTable(COMPANIES_SAMPLE_DATA);
  document.getElementById("c-segment-select").onchange = () => renderCompaniesTable(COMPANIES_SAMPLE_DATA);
  document.getElementById("p-country-select").onchange = () => renderPartnerBDConnector(COMPANIES_SAMPLE_DATA);

  animateCardsIn(el);
}
