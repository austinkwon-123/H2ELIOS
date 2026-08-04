// H₂Grid v6 — JARVIS HUD layer.
// Boot sequence, holographic targeting reticle on selection, decode-text
// effect on the detail sheet. Pure additive module: patches app.js globals.

(function () {
  // ---------- Boot sequence ----------
  function boot() {
    const total = ((window.IEA_META && window.IEA_META.count) || 0) + 138;
    const el = document.createElement("div");
    el.id = "boot";
    el.innerHTML = `
      <img class="boot-word" src="assets/h2elios-lockup.svg" alt="H2ELIOS" />
      <div class="boot-sub" id="boot-sub"></div>
      <div class="boot-bar"><div class="boot-fill"></div></div>`;
    document.body.appendChild(el);

    const sub = document.getElementById("boot-sub");
    const setSub = (text) => {
      if (!sub) return;
      sub.classList.remove("show");
      setTimeout(() => { sub.textContent = text; sub.classList.add("show"); }, 220);
    };
    const t1 = setTimeout(() => setSub(total.toLocaleString() + " facilities · 5 regions · live"), 900);
    const t2 = setTimeout(() => setSub("welcome back"), 1900);
    const kill = () => {
      clearTimeout(t1); clearTimeout(t2);
      el.classList.add("boot-out");
      setTimeout(() => el.remove(), 600);
    };
    setTimeout(kill, 2900);
    el.addEventListener("click", kill);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  // ---------- Targeting reticle ----------
  let reticle = null;
  function ensureReticle() {
    if (reticle || !window.maplibregl || !maplibregl.Marker) return reticle;
    const div = document.createElement("div");
    div.className = "reticle";
    div.innerHTML = '<div class="ret-ring r1"></div><div class="ret-ring r2"></div><div class="ret-x"></div>';
    reticle = new maplibregl.Marker({ element: div });
    return reticle;
  }

  const _selectFacility = selectFacility;
  selectFacility = function (p, lngLat) {
    _selectFacility(p, lngLat);
    const r = ensureReticle();
    if (r && lngLat) r.setLngLat(lngLat).addTo(map);
  };

  const closeBtn = document.getElementById("detail-close");
  if (closeBtn) closeBtn.addEventListener("click", () => { if (reticle) reticle.remove(); });

  // ---------- Decode-text effect on detail sheet ----------
  const GLYPHS = "◢◤▓▒░01H₂ΞΔ<>/*";
  const _showDetail = showDetail;
  showDetail = function (p) {
    _showDetail(p);
    const el = document.querySelector("#detail-card .detail-name");
    if (!el) return;
    const target = el.textContent;
    let step = 0;
    const total = 9;
    const iv = setInterval(() => {
      step++;
      const reveal = Math.floor((step / total) * target.length);
      let out = target.slice(0, reveal);
      for (let i = reveal; i < Math.min(target.length, reveal + 6); i++) {
        out += GLYPHS[(i * 7 + step * 3) % GLYPHS.length];
      }
      el.textContent = out;
      if (step >= total) { el.textContent = target; clearInterval(iv); }
    }, 34);
  };
})();
