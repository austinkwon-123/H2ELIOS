/* ==========================================================================
   H2Grid · Inspector
   Click/hover, detail sheet, project-statistics grid & relationship summary.
   Browser classic scripts share one global lexical scope, so map, helpers &
   state from core are visible here. Load order matters — see index.html.
   ======================================================================= */

// ---- Clicks / hover / detail sheet --------------------------------------------------------------------
function wireClicks() {
  const clickable = ["upstream", "production", "manufacturing", "storage", "pipelines", "endUse", "fuelingStations", "hubs", "flows-base"];
  clickable.forEach((id) => {
    map.on("click", id, (e) => {
      const f = e.features[0];
      selectFacility(f.properties, [e.lngLat.lng, e.lngLat.lat]);
    });
    map.on("mouseenter", id, (e) => {
      map.getCanvas().style.cursor = "pointer";
      const p = e.features[0].properties;
      hoverPopup
        .setLngLat(e.lngLat)
        .setHTML(`<div class="popup-title">${escapeHtml(p.name)}</div><div class="popup-sub">${escapeHtml(p.subtype || "")} · ${escapeHtml(p.status || "")}</div>`)
        .addTo(map);
    });
    map.on("mouseleave", id, () => {
      map.getCanvas().style.cursor = "";
      hoverPopup.remove();
    });
  });
}

function selectFacility(p, lngLat) {
  selectedName = p.name;
  showDetail(p);
  if (lngLat) {
    map.getSource("selection").setData({
      type: "FeatureCollection",
      features: [{ type: "Feature", geometry: { type: "Point", coordinates: lngLat }, properties: {} }]
    });
  }
}

function showDetail(p) {
  const card = document.getElementById("detail-card");
  const el = document.getElementById("detail-content");
  const c = COLORS[p.color] || "#9ca3af";
  const src = p.source ? `<a href="${escapeAttr(p.source)}" target="_blank" rel="noopener">${escapeHtml(hostOf(p.source))}</a>` : "—";
  el.innerHTML = `
    <div class="detail-kicker" style="color:${c}">${escapeHtml(p.subtype || p.category || "")}</div>
    <div class="detail-name">${escapeHtml(p.name)}</div>
    <dl class="detail-grid">
      <dt>Status</dt><dd>${escapeHtml(p.status || "—")} <span class="badge badge-${p.statusClass || "other"}">${badgeText(p.statusClass)}</span></dd>
      <dt>H₂ color</dt><dd style="color:${c}">${escapeHtml(taxonomyLabel(p.color))}</dd>
      <dt>Capacity</dt><dd>${escapeHtml(p.capacity || "—")}</dd>
      <dt>Operator</dt><dd>${escapeHtml(p.operator || "—")}</dd>
      <dt>Region</dt><dd>${escapeHtml(regionLabel(p.region))}</dd>
      <dt>Source</dt><dd>${src}</dd>
      <dt>Updated</dt><dd>${escapeHtml(p.updated || "—")}</dd>
    </dl>
    ${statsBlock(p)}
    ${relationsBlock(p)}
    ${p.note ? `<div class="detail-note">${escapeHtml(p.note)}</div>` : ""}
  `;
  card.hidden = false;
}

function taxonomyLabel(c) {
  return {
    green: "Green — renewable electrolysis",
    blue: "Blue — SMR + carbon capture",
    pink: "Pink — nuclear electrolysis",
    turquoise: "Turquoise — methane pyrolysis",
    gray_blue: "Gray / mixed",
    brown: "Brown / black — coal",
    mfg: "Manufacturing — electrolyzer gigafactory"
  }[c] || c || "—";
}

function regionLabel(r) {
  return { americas: "Americas", latam: "Latin America", apac: "Asia-Pacific", europe: "Europe", mena: "Middle East", africa: "Africa" }[r] || "—";
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function wireDetailClose() {
  document.getElementById("detail-close").addEventListener("click", () => {
    document.getElementById("detail-card").hidden = true;
    selectedName = null;
    map.getSource("selection").setData(emptyFC());
  });
}


// ---- Project statistics & relationships (v8, presentation-only) ---------------
function statNum(str, re, mult) {
  const m = String(str || "").replace(/,/g, "").match(re);
  return m ? parseFloat(m[1]) * (mult || 1) : null;
}

function statOutput(p) {
  const c = p.capacity || "";
  let kt = statNum(c, /([\d.]+)\s*kt/i);
  if (kt == null) {
    const tpd = statNum(c, /([\d.]+)\s*(?:MT\/D|t\/day|t\/d)/i);
    if (tpd != null) kt = (tpd * 365) / 1000;
  }
  if (kt == null) {
    let mw = statNum(c, /([\d.]+)\s*GW/i, 1000);
    if (mw == null) mw = statNum(c, /([\d.]+)\s*MW/i);
    if (mw != null) kt = (mw * 160) / 1000; // ~160 t H2/yr per MWel, est.
  }
  if (kt == null) return null;
  return (kt >= 1 ? kt.toFixed(kt >= 100 ? 0 : 1) + " kt" : Math.round(kt * 1000) + " t") + " H₂/yr (est.)";
}

function statInvest(p) {
  const t = (p.note || "") + " " + (p.capacity || "");
  const m = t.match(/[$€][\d.]+\s*[BM]|\$[\d.]+\s*billion|€[\d.]+B/i);
  return m ? m[0] : null;
}

function statYear(p) {
  const m = String((p.updated || "") + " " + (p.status || "")).match(/20[2-4]\d/);
  return m ? m[0] : null;
}

function statStage(sc) {
  return { operating: "Operating", construction: "Under construction", planned: "Planned / announced", atrisk: "At risk / cancelled" }[sc] || "Unclassified";
}

function statConfidence(p) {
  if (p.tier === "iea") return Number(p.approx) ? "Medium · country-level" : "High · IEA-reported";
  if (p.tier === "api") return p.confidence != null && p.confidence < 1 ? "Medium · approximate location" : "High · IEA-reported (live API)";
  return "High · curated source";
}

function statsBlock(p) {
  const cells = [
    ["Capacity", escapeHtml(p.capacity || "Not disclosed"), "amber"],
    ["Annual H₂ output", escapeHtml(statOutput(p) || "Not disclosed"), statOutput(p) ? "" : "dim"],
    ["Investment", escapeHtml(statInvest(p) || "Not disclosed"), statInvest(p) ? "" : "dim"],
    ["Target online", escapeHtml(statYear(p) || "—"), statYear(p) ? "cyan" : "dim"],
    ["Project stage", escapeHtml(statStage(p.statusClass)), p.statusClass === "atrisk" ? "" : ""],
    ["Data confidence", escapeHtml(statConfidence(p)), ""]
  ];
  return `<div class="stats-head">PROJECT STATISTICS</div><div class="stats-grid">` +
    cells.map(([k, v, cls]) => `<div class="stat-cell"><span class="k">${k}</span><span class="v ${cls}">${v}</span></div>`).join("") +
    `</div>`;
}

function relationsBlock(p) {
  const tokens = String(p.name || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  const hits = (D.flows || []).filter((f) => {
    const n = f.name.toLowerCase();
    return tokens.some((t) => n.includes(t));
  }).slice(0, 3);
  const assets = hits.length
    ? hits.map((f) => `<span class="flow-hit">${escapeHtml(f.name)}</span>`).join("<br>")
    : "No mapped supply-chain links";
  const companies = escapeHtml(p.operator || "Not disclosed");
  const countries = escapeHtml(p.country || regionLabel(p.region));
  return `<div class="stats-head">RELATIONSHIPS</div>
    <div class="rel-row"><span class="k">Linked routes</span>${assets}</div>
    <div class="rel-row"><span class="k">Companies</span>${companies}</div>
    <div class="rel-row"><span class="k">Geography</span>${countries}</div>`;
}
