/* ==========================================================================
   H2Grid · Search & stats
   Facility search, header counters.
   Browser classic scripts share one global lexical scope, so map, helpers &
   state from core are visible here. Load order matters — see index.html.
   ======================================================================= */

// ---- Search --------------------------------------------------------------------------------------
function allFacilities() {
  const items = [];
  const push = (label, features) => {
    if (features) features.forEach((f) => items.push({ label, f }));
  };
  push("Upstream", D.upstream.features);
  push("Production", D.production.features);
  push("Gigafactory", D.manufacturing.features);
  push("Storage", D.storagePoints.features);
  push("Pipeline", D.pipelines.features);
  push("End use", D.endUse.features);
  
  if (window.IEA_DATA) {
    window.IEA_DATA.features.forEach((f) => {
      items.push({ label: "Announced (IEA)", f });
    });
  }

  if (Array.isArray(D.hubs)) {
    D.hubs.forEach((h) => items.push({
      label: "DOE Hub",
      f: { geometry: { type: "Point", coordinates: h.center }, properties: hubProps(h) }
    }));
  }
  return items;
}

function matchesFilters(p) {
  if (statusFilter !== "all" && p.statusClass !== statusFilter) return false;
  if (regionFilter !== "all" && !(REGION_GROUPS[regionFilter] || []).includes(p.region)) return false;
  if (colorFilter && p.color !== colorFilter) return false;
  return true;
}

function wireSearch() {
  const box = document.getElementById("network-search");
  const results = document.getElementById("search-results");
  box.addEventListener("input", renderSearchResults);
  box.addEventListener("focus", renderSearchResults);
  document.addEventListener("click", (e) => {
    if (!document.getElementById("search-capsule").contains(e.target)) results.hidden = true;
  });
  window.addEventListener("resize", () => {
    if (!results.hidden) positionSearchResults();
  });
}

function wireSearchHotkey() {
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      const box = document.getElementById("network-search");
      box.focus();
      box.select();
    }
  });
}

function positionSearchResults() {
  const capsule = document.getElementById("search-capsule");
  const results = document.getElementById("search-results");
  const rect = capsule.getBoundingClientRect();
  results.style.top = `${rect.bottom + 10}px`;
  results.style.right = `${window.innerWidth - rect.right}px`;
}

function renderSearchResults() {
  const box = document.getElementById("network-search");
  const results = document.getElementById("search-results");
  if (document.activeElement !== box && !box.value) { results.hidden = true; return; }
  positionSearchResults();

  const q = (box.value || "").trim().toLowerCase();
  const items = allFacilities().filter(({ f }) => {
    const p = f.properties;
    if (!matchesFilters(p)) return false;
    if (!q) return true;
    return [p.name, p.operator, p.subtype].join(" ").toLowerCase().includes(q);
  });

  results.innerHTML = "";
  items.slice(0, 60).forEach(({ label, f }) => {
    const p = f.properties;
    const btn = document.createElement("button");
    btn.className = "fac-item" + (p.name === selectedName ? " selected" : "");
    btn.style.setProperty("--fac-color", COLORS[p.color] || "#9ca3af");
    btn.innerHTML = `
      <div class="fac-name">${escapeHtml(p.name)}<span class="badge badge-${p.statusClass}">${badgeText(p.statusClass)}</span></div>
      <div class="fac-meta">${escapeHtml(label)} · ${escapeHtml(p.subtype || "")} · ${escapeHtml(p.capacity || "")}</div>`;
    btn.addEventListener("click", () => {
      const c = centroidOf(f);
      stopSpin();
      selectFacility(p, c);
      map.flyTo({ center: c, zoom: p.category === "hub" ? 6 : 8.5, duration: 1600 });
      results.hidden = true;
    });
    results.appendChild(btn);
  });
  results.hidden = items.length === 0;
}

function badgeText(sc) {
  return { operating: "LIVE", construction: "BUILD", planned: "PLAN", atrisk: "RISK", other: "—" }[sc] || "—";
}

function centroidOf(f) {
  if (f.geometry.type === "Point") return f.geometry.coordinates;
  const coords = f.geometry.coordinates;
  const mid = coords[Math.floor(coords.length / 2)];
  return Array.isArray(mid[0]) ? mid[0] : mid;
}


// ---- Stats ------------------------------------------------------------------------------
function renderStats() {
  const staticFeats = [
    ...D.upstream.features, ...D.production.features, ...D.manufacturing.features,
    ...D.storagePoints.features, ...D.pipelines.features, ...D.endUse.features
  ];
  countUp("stat-facilities", staticFeats.length + D.hubs.length);
  countUp("stat-operating", staticFeats.filter((f) => f.properties.statusClass === "operating").length);
}

function countUp(id, target) {
  const el = document.getElementById(id);
  if (!el) return; // ribbon telemetry readout removed - harmless no-op
  const t0 = performance.now(), dur = 900;
  function tick(now) {
    const k = Math.min(1, (now - t0) / dur);
    el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function setStationCount(n) {
  const el = document.getElementById("stat-stations");
  if (el) el.textContent = n; // ribbon telemetry readout removed - harmless no-op
}

