/* ==========================================================================
   H2Grid · Live feeds
   DOE AFDC live stations + ambient star-field zoom fade.
   Browser classic scripts share one global lexical scope, so map, helpers &
   state from core are visible here. Load order matters — see index.html.
   ======================================================================= */

// ---- Live AFDC fetch -----------------------------------------------------------------------------------------
async function loadLiveStations() {
  try {
    const res = await fetch(AFDC_URL);
    if (!res.ok) throw new Error(`AFDC HTTP ${res.status}`);
    const data = await res.json();
    const stations = (data.fuel_stations || []).filter(
      (s) => typeof s.latitude === "number" && typeof s.longitude === "number"
    );
    if (!stations.length) throw new Error("No stations returned");

    const geojson = {
      type: "FeatureCollection",
      features: stations.map((s) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [s.longitude, s.latitude] },
        properties: {
          name: s.station_name || "Hydrogen Station",
          category: "end_use",
          subtype: "Fueling Station",
          color: "gray_blue",
          region: "americas",
          scale: 1,
          statusClass: s.status_code === "E" ? "operating" : "planned",
          capacity: s.access_days_time || "See AFDC listing",
          status: s.status_code === "E" ? "Operating" : (s.status_code === "P" ? "Planned" : "Unknown"),
          operator: s.station_name ? (s.owner_type_code || "—") : "—",
          source: s.updated_at ? `https://afdc.energy.gov/stations#/station/${s.id}` : "https://afdc.energy.gov/stations",
          updated: s.updated_at || "live"
        }
      }))
    };

    addPointLayer("fuelingStations", geojson, { small: true });
    setStatus("live", `${geojson.features.length} live stations`);
    setStationCount(geojson.features.length);
    applyFilters();
  } catch (err) {
    console.warn("Live AFDC fetch failed, keeping cached snapshot:", err);
    setStatus("fallback", "Stations: cached");
    setStationCount(D.fuelingStationsFallback.features.length);
  }
}

function setStatus(kind, text) {
  const el = document.getElementById("api-status");
  el.textContent = text;
  el.className = "pill " + kind;
}


// ---- Ambient space field fades as you approach the surface --------------------
map.on("zoom", () => {
  const z = map.getZoom ? map.getZoom() : 2;
  const fx = Math.max(0.08, Math.min(1, 1 - (z - 2.5) / 3));
  document.documentElement.style.setProperty("--bg-fx", fx.toFixed(2));
});
