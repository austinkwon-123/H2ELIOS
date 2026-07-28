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

  renderCompaniesTable(COMPANIES_SAMPLE_DATA);
  renderPartnerBDConnector(COMPANIES_SAMPLE_DATA);

  document.getElementById("c-search-input").oninput = () => renderCompaniesTable(COMPANIES_SAMPLE_DATA);
  document.getElementById("c-segment-select").onchange = () => renderCompaniesTable(COMPANIES_SAMPLE_DATA);
  document.getElementById("p-country-select").onchange = () => renderPartnerBDConnector(COMPANIES_SAMPLE_DATA);

  animateCardsIn(el);
}
