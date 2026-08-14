/* ==========================================================================
   H2Grid · Advanced Visualization & Spatial Intelligence Module
   Temporal Sandbox dashboard builder, 3D extrusions, and spatial routing.
   ======================================================================= */

window.timelineYear = window.H2Store?.getState().timelineYear || 2026;
window.is3DActive = false;
let timelineInterval = null;
let sandboxChart = null;
let timelineProjectQuery = "";
const TIMELINE_PROJECT_PAGE_SIZE = 40;

const COLOR_HEX_MAP = {
  green: '#34d399',
  blue: '#60a5fa',
  pink: '#f472b6',
  turquoise: '#2dd4bf',
  gray_blue: '#94a3b8',
  brown: '#b45309',
  mfg: '#a78bfa',
  gray: '#94a3b8'
};

// Helper: Parse online year from various formats
function parseOnlineYear(updatedStr) {
  if (!updatedStr) return 2020;
  const m = String(updatedStr).match(/20\d{2}/);
  if (m) return parseInt(m[0]);
  return 2020;
}

// Helper: Parse capacity strings to MWel equivalent
// Returns installed electrolyser/production POWER in MW, or 0 when the record
// does not state one. Three things this must not do, all of which it used to:
//
//   Energy is not power. /GW/ also matches "GWh", so a salt cavern described
//   as "10723 GWh" of stored energy was counted as a 10,723 GW plant — that
//   one record alone was 29% of the cumulative curve.
//
//   Product mass is not capacity. The kt branch caught "850000 ktpa ammonia"
//   and turned it into 14,110 GW, 87% of the announced total. Ammonia and
//   methanol tonnages describe output of a different molecule and cannot be
//   summed into a hydrogen capacity figure.
//
//   Unknown is not 10 MW. Returning a placeholder for the 730 records with no
//   parseable capacity invented roughly 7 GW of plant that nobody announced.
function getCapacityMw(c) {
  if (!c || c === "n/a") return 0;
  let m = c.match(/([\d.]+)\s*GW(?!h)/i);
  if (m) return parseFloat(m[1]) * 1000;
  m = c.match(/([\d.]+)\s*MW(?!h)/i);
  if (m) return parseFloat(m[1]);
  // Annual hydrogen output converted to equivalent continuous power. The 16.6
  // MW per kt/yr factor is the project's existing assumption (~50 kWh/kg at a
  // ~34% capacity factor) and is left unchanged here.
  if (/\b(ammonia|nh3|methanol|meoh|urea)\b/i.test(c)) return 0;
  m = c.match(/([\d.]+)\s*kt/i);
  if (m) return parseFloat(m[1]) * 16.6;
  return 0;
}

// 1. Dataset Pre-processing: Attach numeric onlineYear to all loaded GeoJSON data
function preProcessDatasets() {
  const collections = [
    D.upstream, D.production, D.manufacturing, D.storagePoints, D.pipelines, D.endUse, D.fuelingStationsFallback
  ];

  collections.forEach(col => {
    if (col && Array.isArray(col.features)) {
      col.features.forEach(f => {
        if (f.properties) {
          f.properties.onlineYear = parseOnlineYear(f.properties.updated || f.properties.date);
        }
      });
    }
  });

  if (window.IEA_DATA && Array.isArray(window.IEA_DATA.features)) {
    window.IEA_DATA.features.forEach(f => {
      if (f.properties) {
        f.properties.onlineYear = parseOnlineYear(f.properties.updated);
      }
    });
  }
}

// 2. Temporal Sandbox Page Builder & Renderer
function initTimelinePage() {
  const container = document.getElementById("page-timeline");
  if (!container) return;

  container.innerHTML = `
    <div class="timeline-container">
      <div class="page-header timeline-page-header">
        <div>
          <h2>Network Timeline</h2>
          <p>Explore how the announced hydrogen network changes as projects reach their stated operating year.</p>
        </div>
        <span class="timeline-source-note">Announced + curated records</span>
      </div>
      <div class="timeline-main-grid" style="display: grid; grid-template-columns: 1.12fr 0.88fr; gap: 16px; box-sizing: border-box;">

        <!-- Left column: the time instrument. It sticks while the rollout list
             beside it scrolls past, so the year you are inspecting and the
             projects landing in that year stay on screen together. -->
        <div class="timeline-primary-column" style="display: flex; flex-direction: column; gap: 16px;">
          
          <!-- One instrument, one axis. The year readout, the cumulative
               curve, the per-year additions ruler and the scrubber previously
               sat in three separate cards, each with its own horizontal
               geometry, so nothing lined up and the selected year had to be
               re-found in each. They now share a single 2020-2035 axis: the
               playhead runs through the curve and the ruler at the same x. -->
          <div class="dashboard-card glass timeline-instrument timeline-capacity-card" style="flex: 0 0 auto; padding: 18px; margin: 0; display: flex; flex-direction: column;">

            <div class="ti-readout">
              <div class="ti-year">
                <span class="ti-year-value target-year-title">${window.timelineYear}</span>
                <span class="ti-year-label">selected year</span>
              </div>
              <dl class="ti-stats">
                <div>
                  <dt>Projects online</dt>
                  <dd id="sandbox-kpi-count">0</dd>
                </div>
                <div>
                  <dt>Cumulative capacity</dt>
                  <dd id="sandbox-kpi-cap" class="is-capacity">0 GW</dd>
                </div>
              </dl>
            </div>

            <div class="timeline-capacity-chart ti-plot" style="position: relative;">
              <canvas id="sandbox-capacity-chart"></canvas>
            </div>

            <!-- Ruler: capacity added per year, aligned to the plot's x-axis. -->
            <div id="temporal-milestones" class="ti-ruler"></div>

            <label class="ti-scrub">
              <span class="sr-only">Selected year</span>
              <input type="range" class="temporal-slider" id="sandbox-slider" min="2020" max="2035" step="1" value="${window.timelineYear}" />
            </label>

            <div class="ti-actions">
              <button id="sandbox-play-btn" class="ti-play" type="button">▶ Play</button>
              <span id="sandbox-year-label" class="ti-year-echo" aria-hidden="true">${window.timelineYear}</span>
              <button id="timeline-apply-map" class="ti-apply" type="button">Apply year to map</button>
            </div>
          </div>

        </div>

        <!-- Right column: every project entering operation in the selected
             year, listed in full. No inner scroller — the page carries it. -->
        <div class="dashboard-card glass timeline-pipeline-card" style="display: flex; flex-direction: column; padding: 16px; margin: 0; box-sizing: border-box;">
          <h2 class="stats-head">Timeline Pipeline Rollouts (<span class="target-year-title">${window.timelineYear}</span>)</h2>
          <p style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 12px;">Announced and curated facilities scheduled to enter operation in this specific year.</p>
          <div class="timeline-list-tools">
            <input id="sandbox-project-search" class="search-input" type="search" placeholder="Filter this year's projects" aria-label="Filter projects scheduled for the selected year" />
            <span id="sandbox-project-count" aria-live="polite"></span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px;" id="sandbox-project-list">
            <!-- Renders lists dynamically -->
          </div>
        </div>

      </div>
    </div>
  `;

  // Bind slider controls
  const slider = document.getElementById("sandbox-slider");
  const label = document.getElementById("sandbox-year-label");
  const playBtn = document.getElementById("sandbox-play-btn");
  const projectSearch = document.getElementById("sandbox-project-search");
  const applyMapButton = document.getElementById("timeline-apply-map");

  slider.oninput = () => {
    window.H2Store?.dispatch({ type: "TIMELINE_YEAR_UPDATE", payload: { year: parseInt(slider.value) } });
    window.timelineYear = window.H2Store?.getState().timelineYear || parseInt(slider.value);
    label.textContent = window.timelineYear;
    updateSandboxDashboard();
  };

  projectSearch.oninput = () => {
    timelineProjectQuery = projectSearch.value.trim().toLowerCase();
    updateSandboxDashboard();
  };

  playBtn.onclick = () => {
    if (timelineInterval) {
      clearInterval(timelineInterval);
      timelineInterval = null;
      playBtn.textContent = "▶ Play";
    } else {
      playBtn.textContent = "⏸ Pause";
      if (parseInt(slider.value) >= 2035) {
        slider.value = 2020;
      }
      timelineInterval = setInterval(() => {
        let val = parseInt(slider.value);
        val = val >= 2035 ? 2020 : val + 1;
        slider.value = val;
        window.H2Store?.dispatch({ type: "TIMELINE_YEAR_UPDATE", payload: { year: val } });
        window.timelineYear = window.H2Store?.getState().timelineYear || val;
        label.textContent = val;
        updateSandboxDashboard();
      }, 950);
    }
  };

  // The plot is the control. Dragging across the curve sets the year, so the
  // chart stops being a read-only picture sitting above its own slider. The
  // range input is kept as the accessible, keyboard-operable path.
  const plot = container.querySelector(".ti-plot");
  if (plot) {
    const yearFromPointer = (event) => {
      if (!sandboxChart || !sandboxChart.chartArea) return null;
      const rect = sandboxChart.canvas.getBoundingClientRect();
      const { left, right } = sandboxChart.chartArea;
      const scaleX = rect.width / sandboxChart.width;
      const x = event.clientX - rect.left;
      const t = (x - left * scaleX) / Math.max(1, (right - left) * scaleX);
      const idx = Math.round(t * (yearsArr.length - 1));
      return yearsArr[Math.max(0, Math.min(yearsArr.length - 1, idx))];
    };
    const scrubTo = (event) => {
      const year = yearFromPointer(event);
      if (year == null || year === window.timelineYear) return;
      slider.value = String(year);
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    };
    plot.addEventListener("pointerdown", (event) => {
      plot.setPointerCapture(event.pointerId);
      scrubTo(event);
    });
    plot.addEventListener("pointermove", (event) => {
      if (plot.hasPointerCapture(event.pointerId)) scrubTo(event);
    });
    plot.addEventListener("pointerup", (event) => plot.releasePointerCapture(event.pointerId));
  }

  applyMapButton.onclick = () => {
    window.beginMapHandoff?.({
      fromRoute: "timeline",
      label: "Timeline",
      year: window.timelineYear,
      selectionId: null
    });
  };

  window.registerRouteCleanup?.("timeline", () => {
    if (!timelineInterval) return;
    clearInterval(timelineInterval);
    timelineInterval = null;
    const button = document.getElementById("sandbox-play-btn");
    if (button) button.textContent = "▶ Play";
  });

  // Compile Capacity Growth Curve data in advance
  compileGrowthCurve();

  // Initial dashboard load
  updateSandboxDashboard();
}

let yearsArr = [];
let capacityCurveData = [];
let incrementalCapByYear = {};

function compileGrowthCurve() {
  yearsArr = Array.from({ length: 16 }, (_, i) => 2020 + i); // 2020 to 2035
  const yearlyCap = {};
  yearsArr.forEach(y => yearlyCap[y] = 0);

  // Scan curated features
  const allCurated = [
    ...D.upstream.features, ...D.production.features, ...D.manufacturing.features,
    ...D.storagePoints.features, ...D.pipelines.features, ...D.endUse.features
  ];
  allCurated.forEach(f => {
    const y = parseOnlineYear(f.properties.updated || f.properties.date);
    if (yearlyCap.hasOwnProperty(y)) {
      yearlyCap[y] += getCapacityMw(f.properties.capacity);
    }
  });

  // Scan IEA announced features
  if (window.IEA_DATA) {
    window.IEA_DATA.features.forEach(f => {
      const y = parseOnlineYear(f.properties.updated);
      if (yearlyCap.hasOwnProperty(y)) {
        yearlyCap[y] += getCapacityMw(f.properties.capacity);
      }
    });
  }

  // Calculate cumulative sum
  let acc = 0;
  capacityCurveData = yearsArr.map(y => {
    acc += (yearlyCap[y] / 1000); // convert to GW
    return parseFloat(acc.toFixed(2));
  });
  incrementalCapByYear = yearlyCap;
}

// Milestone strip: one bar per year showing capacity ADDED that year (not
// cumulative), so the scrubber itself shows where the real build-out
// happens instead of being a bare handle with no context underneath it —
// the brief's "long horizontal glass timeline with capacity milestones."
function renderTemporalMilestones() {
  const el = document.getElementById("temporal-milestones");
  if (!el || !yearsArr.length) return;
  const W = 640, H = 46;
  const n = yearsArr.length;
  // Inset the ruler to the plot's own drawing area so a bar sits directly
  // under the curve point for the same year. Without this the ruler spanned
  // the full card while the plot was inset by its y-axis, and the two
  // horizontal scales disagreed by ~30px across the whole width.
  let padL = 10, padR = 10;
  const area = sandboxChart && sandboxChart.chartArea;
  const canvasW = sandboxChart && sandboxChart.width;
  if (area && canvasW > 0) {
    padL = (area.left / canvasW) * W;
    padR = ((canvasW - area.right) / canvasW) * W;
  }
  // A line chart's category scale runs point-to-point across the plot
  // (offset:false), so year i sits at left + i*(width/(n-1)) — not at the
  // centre of an i-th band. Using band centres put the ruler up to 15px out
  // of step with the curve, which is exactly the misreading this alignment
  // is meant to prevent.
  const step = (W - padL - padR) / (n - 1);
  const barW = step * 0.55;
  const maxInc = Math.max(1, ...yearsArr.map((y) => incrementalCapByYear[y] || 0));

  const bars = yearsArr.map((y, i) => {
    const inc = incrementalCapByYear[y] || 0;
    const h = 4 + (inc / maxInc) * 30;
    const x = padL + i * step - barW / 2;
    const w = barW;
    const isCurrent = y === window.timelineYear;
    const isPast = y < window.timelineYear;
    const fill = isCurrent ? "#3fd6e8" : isPast ? "rgba(63,214,232,0.45)" : "rgba(120,160,200,0.18)";
    return `<rect x="${x.toFixed(1)}" y="${(H - 14 - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${fill}"><title>${y}: +${inc.toFixed(0)} MW added</title></rect>`;
  }).join("");

  const ticks = yearsArr.filter((y) => y % 3 === 0 || y === yearsArr[0] || y === yearsArr[n - 1]).map((y) => {
    const i = yearsArr.indexOf(y);
    const x = padL + i * step;
    return `<text x="${x.toFixed(1)}" y="${H - 2}" text-anchor="middle" font-size="8.5" fill="#67748c" font-family="var(--font-mono)">${y}</text>`;
  }).join("");

  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%; height:${H}px; display:block;" role="img" aria-label="Capacity added per year">${bars}${ticks}</svg>`;
}

// Small count-up/count-down tween so the KPI numbers settle into place
// rather than snapping — the brief's "animated number transitions, but
// avoid rolling odometer effects" (one smooth ease, not per-digit spin).
function animateNumber(el, from, to, { decimals = 0, suffix = "" } = {}) {
  if (!el) return;
  const start = performance.now();
  const dur = 380;
  const step = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 3);
    const val = from + (to - from) * eased;
    el.textContent = val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function updateSandboxDashboard() {
  // Update year labels across text titles
  document.querySelectorAll(".target-year-title").forEach(el => {
    el.textContent = window.timelineYear;
  });

  // Gather active projects details and count totals
  let countTotal = 0;
  let capacityMwTotal = 0;
  const targetYearProjects = [];

  const addTarget = (f, sourceTag) => {
    const p = f.properties;
    const y = p.onlineYear || 2020;
    
    if (y <= window.timelineYear) {
      countTotal++;
      capacityMwTotal += getCapacityMw(p.capacity);
    }
    
    if (y === window.timelineYear) {
      targetYearProjects.push({ f, sourceTag });
    }
  };

  // Compile curated
  [...D.upstream.features, ...D.production.features, ...D.manufacturing.features, ...D.storagePoints.features, ...D.endUse.features]
    .forEach(f => addTarget(f, "Curated"));

  // Compile IEA announced
  if (window.IEA_DATA) {
    window.IEA_DATA.features.forEach(f => addTarget(f, "Announced"));
  }

  // Render KPIs — animated tween rather than a snap, so moving the year
  // reads as the totals actually recomputing rather than a static swap.
  const countKpi = document.getElementById("sandbox-kpi-count");
  const capKpi = document.getElementById("sandbox-kpi-cap");
  if (countKpi) {
    const from = parseFloat((countKpi.textContent || "0").replace(/,/g, "")) || 0;
    animateNumber(countKpi, from, countTotal, { decimals: 0 });
  }
  if (capKpi) {
    const from = parseFloat((capKpi.textContent || "0").replace(/[^0-9.]/g, "")) || 0;
    animateNumber(capKpi, from, capacityMwTotal / 1000, { decimals: 1, suffix: " GW" });
  }
  renderTemporalMilestones();

  // Render pipeline list for target year
  const listContainer = document.getElementById("sandbox-project-list");
  const listCount = document.getElementById("sandbox-project-count");
  if (listContainer) {
    if (targetYearProjects.length === 0) {
      if (listCount) listCount.textContent = "0 projects";
      listContainer.innerHTML = `<div class="news-empty" style="padding:40px 0;">No projects scheduled to enter operations in ${window.timelineYear}.</div>`;
    } else {
      // Sort largest first, then keep the working set scannable. Search still
      // covers the full year, so reducing identical rows does not hide data.
      targetYearProjects.sort((a, b) => getCapacityMw(b.f.properties.capacity) - getCapacityMw(a.f.properties.capacity));
      const matchingProjects = timelineProjectQuery ? targetYearProjects.filter(({ f }) => {
        const p = f.properties || {};
        return [p.name, p.country, p.subtype, p.status, p.operator]
          .some((value) => String(value || "").toLowerCase().includes(timelineProjectQuery));
      }) : targetYearProjects;
      const visibleProjects = matchingProjects.slice(0, TIMELINE_PROJECT_PAGE_SIZE);
      if (listCount) {
        listCount.textContent = matchingProjects.length > visibleProjects.length ?
          `${visibleProjects.length} of ${matchingProjects.length}` : `${matchingProjects.length} project${matchingProjects.length === 1 ? "" : "s"}`;
      }

      if (matchingProjects.length === 0) {
        listContainer.innerHTML = `<div class="news-empty" style="padding:40px 0;">No projects match “${escapeHtml(timelineProjectQuery)}” in ${window.timelineYear}.</div>`;
        renderSandboxChart();
        return;
      }

      listContainer.innerHTML = visibleProjects.map(item => {
        const p = item.f.properties;
        const coords = item.f.geometry.coordinates;
        const cap = p.capacity || "n/a";
        const cHex = COLOR_HEX_MAP[p.color] || '#3fd6e8';
        const canMap = Array.isArray(coords) && coords.length >= 2 && !Number(p.approx);
        const action = canMap ? `<button class="tab-btn timeline-project-map" type="button" data-project-index="${visibleProjects.indexOf(item)}">View on Map</button>` : "";

        return `
          <div style="background:var(--bg-1); border:1px solid var(--line); border-radius:var(--r-md); padding:10px 12px; display:flex; justify-content:space-between; align-items:center; gap:12px; position:relative;">
            <div style="position:absolute; left:0; top:8px; bottom:8px; width:2px; background:${cHex};"></div>
            <div style="overflow:hidden; flex:1;">
              <div style="font-weight:600; font-size:11.5px; color:var(--text-hi); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${escapeHtml(p.name)}</div>
              <div style="font-size:10.5px; color:var(--text-muted); margin-top:2px;">
                ${escapeHtml(p.subtype || "Facility")} · ${escapeHtml(cap)} · <span class="badge badge-${p.statusClass || "other"}" style="font-size:9.5px; padding:1px 4px; vertical-align:middle;">${escapeHtml(p.status)}</span>
              </div>
            </div>
            ${action}
          </div>
        `;
      }).join("") + (matchingProjects.length > visibleProjects.length ?
        `<div class="timeline-list-limit">Showing the first ${TIMELINE_PROJECT_PAGE_SIZE} by capacity. Use the filter to find a specific project.</div>` : "");
      listContainer.querySelectorAll(".timeline-project-map").forEach((button) => {
        const item = visibleProjects[Number(button.dataset.projectIndex)];
        if (!item) return;
        button.addEventListener("click", () => flyToAndShowMapProject(item.f.geometry.coordinates, item.f.properties));
      });
    }
  }

  // Draw or update Chart.js
  renderSandboxChart();
}

// Interactive cross-routing: Fly map camera and open Project Inspector
window.flyToAndShowMapProject = function(coords, p) {
  if (!Array.isArray(coords) || coords.length < 2 || Number(p?.approx)) return;
  window.beginMapHandoff?.({ fromRoute: "timeline", label: "Timeline", selectionId: p.id || p.name, props: p, lngLat: coords });
};

function applyTimelineFilter() {
  window.timelineYear = window.H2Store?.getState().timelineYear || window.timelineYear;
  if (typeof applyFilters === "function") applyFilters();
}
window.applyTimelineFilter = applyTimelineFilter;

function renderSandboxChart() {
  const ctx = document.getElementById("sandbox-capacity-chart");
  if (!ctx) return;

  if (sandboxChart) {
    sandboxChart.update("none");
    return;
  }

  const gridColor = "rgba(120, 160, 200, 0.05)";
  const labelColor = "#94a3b8";

  // Create local, inline year tracker line plugin
  const customYearLinePlugin = {
    id: 'customYearLine',
    beforeDraw: (chart) => {
      const { ctx, chartArea, scales } = chart;
      const xScale = scales.x;
      // Category scale: getPixelForValue() takes the INDEX, not the label.
      // Passing the year itself returned ~32767 against a chart area of about
      // 43-550, so the bounds check below always failed and this playhead was
      // never actually drawn.
      const idx = yearsArr.indexOf(window.timelineYear);
      if (idx < 0) return;
      const xPixel = xScale.getPixelForValue(idx);

      if (xPixel >= chartArea.left && xPixel <= chartArea.right) {
        ctx.save();
        // Amber, not the data's cyan. A playhead drawn in the series colour
        // reads as one more gridline; it has to say "you are here" instead.
        ctx.strokeStyle = "#d99a3d";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(xPixel, chartArea.top);
        ctx.lineTo(xPixel, chartArea.bottom);
        ctx.stroke();
        // Cap: a small solid wedge at the top so the head is findable at a
        // glance even where the line crosses a dense part of the curve.
        ctx.fillStyle = "#d99a3d";
        ctx.beginPath();
        ctx.moveTo(xPixel - 4, chartArea.top);
        ctx.lineTo(xPixel + 4, chartArea.top);
        ctx.lineTo(xPixel, chartArea.top + 5);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
  };

  sandboxChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: yearsArr,
      datasets: [{
        label: "Projected GW Capacity",
        data: capacityCurveData,
        borderColor: "#3fd6e8",
        borderWidth: 1.8,
        // Everything past the selected year is still an announcement, so it is
        // drawn as a dashed, dimmed continuation rather than the same confident
        // line. Scrubbing therefore shows commitment receding, not just a
        // marker sliding along an unchanging curve.
        segment: {
          borderColor: (c) => (yearsArr[c.p1DataIndex] > window.timelineYear ? "rgba(63,214,232,0.34)" : "#3fd6e8"),
          borderDash: (c) => (yearsArr[c.p1DataIndex] > window.timelineYear ? [4, 3] : undefined)
        },
        pointBackgroundColor: (c) => (yearsArr[c.dataIndex] > window.timelineYear ? "rgba(63,214,232,0.34)" : "#3fd6e8"),
        pointBorderColor: "#01030a",
        pointHoverRadius: 5,
        pointRadius: (c) => (yearsArr[c.dataIndex] === window.timelineYear ? 4 : 2),
        fill: true,
        backgroundColor: "rgba(63, 214, 232, 0.04)",
        tension: 0.25
      }]
    },
    plugins: [customYearLinePlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: labelColor, font: { size: 9.5 } }
        },
        y: {
          grid: { color: gridColor },
          // The axis previously ran to "35,000" with no unit anywhere near it,
          // so the only clue to the scale was the KPI above. State it.
          title: { display: true, text: "Cumulative capacity (GW)", color: labelColor, font: { size: 10 } },
          ticks: {
            color: labelColor,
            font: { size: 9.5 },
            callback: (v) => (v >= 1000 ? (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 }) + "k" : v)
          }
        }
      }
    }
  });
}

// 3. 3D Volumetric Extrusions Layer & Controls
function inject3DControls() {
  const dock = document.getElementById("map-mode-switch");
  if (!dock || document.getElementById("dock-3d-btn")) return;

  const btn = document.createElement("button");
  btn.className = "mode-btn map-advanced-control";
  btn.id = "dock-3d-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "3D capacity extrusions");
  btn.setAttribute("data-tip", "3D capacity extrusions");
  btn.textContent = "3D Capacity";
  dock.appendChild(btn);

  btn.onclick = () => {
    window.is3DActive = !window.is3DActive;
    window.H2Store?.dispatch({ type: "MAP_3D_UPDATE", payload: { value: window.is3DActive } });
    btn.classList.toggle("active", window.is3DActive);

    // The live API tier owns a native fill-extrusion layer while curated/IEA
    // capacity uses H2GSpikes. Leaving the native layer visible after this
    // switch turned off made the control lie and left hundreds of bars hiding
    // the physical pipeline ribbons. One mode switch owns both renderers.
    if (map.getLayer("api-projects-extrusion")) {
      map.setLayoutProperty("api-projects-extrusion", "visibility", window.is3DActive ? "visible" : "none");
    }

    if (window.is3DActive) {
      // Idle rotation re-arms itself on every moveend, so without this the
      // globe keeps drifting out from under a pitched 3D view — including
      // during the easeTo below, which fights its own camera animation.
      stopSpin();
      map.easeTo({ pitch: 48, bearing: -18, duration: 1000 });
      // The point markers stay visible. Hiding them made sense when 3D
      // REPLACED the flat markers, but the soft clouds now read as the
      // ground-level glow the beams rise out of — hiding them left every
      // spike floating with nothing anchoring it to a location.
      update3DTowers();
      window.H2GSpikes.setVisible(true);
    } else {
      map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
      window.H2GSpikes.setVisible(false);
    }
  };
}

function update3DTowers() {
  if (!window.is3DActive || !window.H2GSpikes) return;

  const activeTowers = [];
  const checkFilters = (p) => {
    if (statusFilter !== "all" && p.statusClass !== statusFilter) return false;
    if (regionFilter !== "all" && !(REGION_GROUPS[regionFilter] || []).includes(p.region)) return false;
    if (colorFilter && p.color !== colorFilter) return false;
    if (p.onlineYear && p.onlineYear > window.timelineYear) return false;
    return true;
  };

  // Every curated tier that carries a capacity figure, each gated on its own
  // dock toggle so the beams track the rail. Manufacturing and upstream were
  // previously excluded, which meant the violet (electrolyser gigafactory) and
  // pink (nuclear) taxonomy colours could never appear as beams at all — the
  // globe could only ever show green / blue / gray_blue / brown.
  const SPIKE_TIERS = [["facilities", D.production], ["facilities", D.storagePoints], ["facilities", D.manufacturing], ["facilities", D.upstream]];
  const points = [];
  SPIKE_TIERS.forEach(([toggleKey, fc]) => {
    if (fc && fc.features && layerVisible(toggleKey)) points.push(...fc.features);
  });
  if (window.IEA_DATA && layerVisible("announced")) {
    window.IEA_DATA.features.forEach(f => {
      if (f.properties.category === "production" || f.properties.category === "storage") {
        points.push(f);
      }
    });
  }

  points.forEach(f => {
    const p = f.properties;
    if (!checkFilters(p)) return;

    const coords = f.geometry.coordinates;
    activeTowers.push({
      lng: coords[0],
      lat: coords[1],
      capacityMw: getCapacityMw(p.capacity),
      colorHex: COLOR_HEX_MAP[p.color] || '#3fd6e8'
    });
  });

  // Rendered by the custom WebGL layer in 20-spikes.js, not fill-extrusion:
  // MapLibre ignores fill-extrusion-height under globe projection, so native
  // extrusions drape flat to the sphere and no bars appear at all.
  window.H2GSpikes.setData(activeTowers);
}

// 4. Hook into filter chain to dynamically handle timeline year limits
const _currentFilterVis = currentFilter;
currentFilter = function () {
  const base = _currentFilterVis();
  const parts = base ? [...base] : ["all"];
  parts.push(["<=", ["coalesce", ["get", "onlineYear"], 2020], window.timelineYear]);
  return parts;
};

const _applyFiltersVis = applyFilters;
applyFilters = function () {
  _applyFiltersVis();
  // Rebuild the beams on every filter change. No longer re-hides the point
  // markers — applyFilters runs constantly, so it was undoing any attempt to
  // keep them visible in 3D.
  if (window.is3DActive) update3DTowers();
};

// Main entry point
function initVisualizationModule() {
  preProcessDatasets();
  inject3DControls();
  enable3DOnFirstLoad();
}

function enable3DOnFirstLoad() {
  // Reader-width layouts deliberately hide the advanced 3D control. Starting
  // them in the state that control would toggle on made the pitched globe and
  // long capacity beams overflow the narrow canvas with no visible way back.
  if (window.innerWidth <= 720) return;
  const activate = () => {
    if (window.innerWidth <= 720) return false;
    const button = document.getElementById("dock-3d-btn");
    if (!button || !window.H2GSpikes || !map.getLayer("h2grid-3d-spikes") || window.is3DActive) return false;
    button.click();
    return true;
  };
  if (activate()) return;
  map.once("load", () => requestAnimationFrame(activate));
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initVisualizationModule);
else initVisualizationModule();
