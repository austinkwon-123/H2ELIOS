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

// ---- Command palette --------------------------------------------------
// The existing Cmd/Ctrl+K search box becomes the palette's entry point
// rather than a second competing modal — "search plus actions" in one
// place, matching what a real Spotlight-style palette is (not a chatbot,
// no free-text query parsing: a fixed, typo-tolerant list of concrete
// commands, same as the workspace switcher's own routes).
const PALETTE_WORKSPACES = [
  { label: "Go to Explore (Map)", route: "map" },
  { label: "Go to Economics", route: "market" },
  { label: "Go to Technology", route: "technology" },
  { label: "Go to Demand & Transport", route: "demand-transport" },
  { label: "Go to Policy", route: "policy" },
  { label: "Go to Timeline", route: "timeline" },
  { label: "Go to Organizations", route: "companies" },
  { label: "Go to Calculator", route: "tools" }
];

// Sentinel contract: an omitted (undefined) color preserves the current colorFilter;
// an explicit null clears it — "Clear all map filters" relies on that.
function applyCommandFilter({ status = null, region = null, color = undefined } = {}) {
  if (status !== null) statusFilter = status;
  if (region !== null) regionFilter = region;
  if (color !== undefined) colorFilter = color;
  document.querySelectorAll("#status-seg .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.status === statusFilter));
  document.querySelectorAll("#region-seg .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.region === regionFilter));
  document.querySelectorAll("#color-seg .legend-dot").forEach((b) => {
    b.classList.toggle("active", colorFilter === b.dataset.color);
    b.classList.toggle("dimmed", !!colorFilter && colorFilter !== b.dataset.color);
  });
  if (location.hash.slice(1) !== "map") { location.hash = "map"; navigateTo("map"); }
  applyFilters();
}

const PALETTE_ACTIONS = [
  { label: "Show only operating projects", run: () => applyCommandFilter({ status: "operating" }) },
  { label: "Show only under-construction projects", run: () => applyCommandFilter({ status: "construction" }) },
  { label: "Show only green hydrogen", run: () => applyCommandFilter({ color: "green" }) },
  { label: "Show only blue hydrogen", run: () => applyCommandFilter({ color: "blue" }) },
  { label: "Clear all map filters", run: () => applyCommandFilter({ status: "all", region: "all", color: null }) }
];

function paletteMatches(query) {
  const q = query.trim().toLowerCase();
  const workspaces = PALETTE_WORKSPACES.filter((c) => !q || c.label.toLowerCase().includes(q));
  const actions = PALETTE_ACTIONS.filter((c) => !q || c.label.toLowerCase().includes(q));
  return { workspaces, actions };
}

let searchActiveIndex = -1;

function setSearchResultsOpen(open) {
  const box = document.getElementById("network-search");
  const results = document.getElementById("search-results");
  results.hidden = !open;
  box.setAttribute("aria-expanded", String(open));
  if (!open) {
    searchActiveIndex = -1;
    box.removeAttribute("aria-activedescendant");
  }
}

function searchResultOptions() {
  return Array.from(document.querySelectorAll("#search-results .fac-item, #search-results .palette-item"));
}

function setActiveSearchOption(index) {
  const box = document.getElementById("network-search");
  const options = searchResultOptions();
  if (!options.length) return;
  searchActiveIndex = (index + options.length) % options.length;
  options.forEach((option, i) => option.setAttribute("aria-selected", String(i === searchActiveIndex)));
  const active = options[searchActiveIndex];
  box.setAttribute("aria-activedescendant", active.id);
  active.scrollIntoView?.({ block: "nearest" });
}

function renderPaletteSection(workspaces, actions) {
  if (!workspaces.length && !actions.length) return "";
  const row = (label, onClick) => {
    const btn = document.createElement("button");
    btn.className = "palette-item";
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    return btn;
  };
  const frag = document.createDocumentFragment();
  if (workspaces.length) {
    const head = document.createElement("div");
    head.className = "palette-section-label";
    head.textContent = "Go to";
    frag.appendChild(head);
    workspaces.forEach((c) => frag.appendChild(row(c.label, () => {
      location.hash = c.route;
      navigateTo(c.route);
      setSearchResultsOpen(false);
    })));
  }
  if (actions.length) {
    const head = document.createElement("div");
    head.className = "palette-section-label";
    head.textContent = "Actions";
    frag.appendChild(head);
    actions.forEach((c) => frag.appendChild(row(c.label, () => {
      c.run();
      setSearchResultsOpen(false);
    })));
  }
  return frag;
}

function wireSearch() {
  const box = document.getElementById("network-search");
  const results = document.getElementById("search-results");
  box.setAttribute("role", "combobox");
  box.setAttribute("aria-autocomplete", "list");
  box.setAttribute("aria-controls", "search-results");
  box.setAttribute("aria-expanded", "false");
  results.setAttribute("role", "listbox");
  results.setAttribute("aria-label", "H2ELIOS search results");
  box.addEventListener("input", () => {
    searchActiveIndex = -1;
    box.removeAttribute("aria-activedescendant");
    renderSearchResults();
  });
  box.addEventListener("focus", renderSearchResults);
  box.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.hidden) renderSearchResults();
      setActiveSearchOption(searchActiveIndex + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter" && searchActiveIndex >= 0) {
      event.preventDefault();
      searchResultOptions()[searchActiveIndex]?.click();
    } else if (event.key === "Escape") {
      setSearchResultsOpen(false);
      box.select();
    }
  });
  document.addEventListener("click", (e) => {
    if (!document.getElementById("search-capsule").contains(e.target) && !results.contains(e.target)) setSearchResultsOpen(false);
  });
  window.addEventListener("resize", () => {
    if (!results.hidden) positionSearchResults();
  });
  // Reposition when an inspector opens or closes, so the dropdown never ends up
  // under it. Shares the shell's single inspector observer (23-spatial-shell.js)
  // rather than starting a second one on the same nodes.
  if (typeof onRightPanelToggle === "function") {
    onRightPanelToggle(() => { if (!results.hidden) positionSearchResults(); });
  }
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
  let top = rect.bottom + 10;
  // On the map page, #map-mode-switch (Explore/Research/Markets) shares
  // this same top-right corner - clear its bottom edge too, or the
  // palette's own top rows land underneath it. getBoundingClientRect()
  // returns a zero rect when #page-map (its ancestor) is hidden, so this
  // is a no-op on every other route without needing its own visibility
  // check.
  const modeSwitch = document.getElementById("map-mode-switch");
  if (modeSwitch) {
    const msRect = modeSwitch.getBoundingClientRect();
    if (msRect.width) top = Math.max(top, msRect.bottom + 10);
  }
  results.style.top = `${top}px`;

  // Horizontal geometry has exactly one owner per breakpoint. Below 720px the
  // stylesheet owns it (full-bleed sheet), so every inline value is cleared —
  // inline styles would otherwise silently outrank the media query. Above it
  // this function owns it, because only JS can read the live inspector width.
  if (window.innerWidth <= 720) {
    results.style.removeProperty("right");
    results.style.removeProperty("width");
    return;
  }

  const openInspector = document.querySelector(".right-panel-slot:not([hidden])");
  if (openInspector) {
    // offsetLeft is stable while the inspector's entrance transform is still
    // animating; getBoundingClientRect() would place search against the moving
    // visual edge and leave the two surfaces touching after the animation.
    const inspectorLeft = openInspector.offsetLeft;
    const sidebarWidth = parseFloat(getComputedStyle(document.body).getPropertyValue("--sidebar-width")) || 0;
    const availableWidth = Math.max(240, inspectorLeft - sidebarWidth - 32);
    results.style.right = `${window.innerWidth - inspectorLeft + 16}px`;
    results.style.width = `${Math.min(420, availableWidth)}px`;
  } else {
    results.style.right = `${window.innerWidth - rect.right}px`;
    results.style.removeProperty("width");
  }
}

function renderSearchResults() {
  const box = document.getElementById("network-search");
  const results = document.getElementById("search-results");
  if (document.activeElement !== box && !box.value) { setSearchResultsOpen(false); return; }
  positionSearchResults();

  const rawQuery = box.value || "";
  const q = rawQuery.trim().toLowerCase();
  const items = allFacilities().filter(({ f }) => {
    const p = f.properties;
    if (!matchesFilters(p)) return false;
    if (!q) return true;
    return [p.name, p.operator, p.subtype].join(" ").toLowerCase().includes(q);
  });

  const { workspaces, actions } = paletteMatches(rawQuery);

  results.innerHTML = "";
  const paletteFrag = renderPaletteSection(workspaces, actions);
  if (paletteFrag) results.appendChild(paletteFrag);

  if (q && (workspaces.length || actions.length) && items.length) {
    const head = document.createElement("div");
    head.className = "palette-section-label";
    head.textContent = "Facilities";
    results.appendChild(head);
  }

  items.slice(0, 60).forEach(({ label, f }) => {
    const p = f.properties;
    const btn = document.createElement("button");
    btn.className = "fac-item" + (p.name === selectedName ? " selected" : "");
    btn.style.setProperty("--fac-color", COLORS[p.color] || "#9ca3af");
    btn.innerHTML = `
      <div class="fac-name">${escapeHtml(p.name)}<span class="badge badge-${p.statusClass}">${badgeText(p.statusClass)}</span></div>
      <div class="fac-meta">${escapeHtml(label)} · ${escapeHtml(p.subtype || "")} · ${escapeHtml(p.capacity || "")}</div>`;
    btn.addEventListener("click", () => {
      window.H2GDetailReturnFocus = box;
      const c = centroidOf(f);
      const jumpAndSelect = () => {
        stopSpin();
        selectFacility(p, c);
        map.flyTo({ center: c, zoom: p.category === "hub" ? 6 : 8.5, duration: 1600 });
      };
      // The search capsule is reachable from every workspace, but the map
      // (and selectFacility's DOM) only exists under #page-map — jump
      // there first if a facility result is clicked from another tab,
      // instead of silently doing nothing.
      if (location.hash.slice(1) !== "map") {
        location.hash = "map";
        navigateTo("map");
        requestAnimationFrame(jumpAndSelect);
      } else {
        jumpAndSelect();
      }
      setSearchResultsOpen(false);
    });
    results.appendChild(btn);
  });
  const options = searchResultOptions();
  options.forEach((option, index) => {
    option.id = `search-option-${index}`;
    option.setAttribute("role", "option");
    option.setAttribute("tabindex", "-1");
    option.setAttribute("aria-selected", "false");
  });
  setSearchResultsOpen(options.length > 0);
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
