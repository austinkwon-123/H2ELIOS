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

    // Live AFDC replaces the US fallback wholesale, but EU stations
    // (js/eu-stations-data.js, static - no live EU equivalent to poll) are
    // merged back in every time so they don't disappear once the live US
    // fetch succeeds.
    const merged = mergeFeatureCollections(geojson, window.EU_STATIONS_DATA);
    addPointLayer("fuelingStations", merged, { small: true });
    setStatus("live", `${merged.features.length} live stations`);
    setStationCount(merged.features.length);
    applyFilters();
  } catch (err) {
    console.warn("Live AFDC fetch failed, keeping cached snapshot:", err);
    setStatus("fallback", "Stations: cached");
    setStationCount(D.fuelingStationsFallback.features.length + ((window.EU_STATIONS_DATA && window.EU_STATIONS_DATA.features.length) || 0));
  }
}

function setStatus(kind, text) {
  const el = document.getElementById("api-status");
  el.textContent = text;
  el.className = "pill " + kind;
}


// ---- Ambient space field fades as you approach the surface --------------------
// Fully opaque (orbital/space view) at zoom <= 3, linearly fades to fully clear
// by zoom 6 so ground-level regional analysis stays visually focused on the
// data nodes. Shares its 3->6 schedule with the sky atmosphere-blend and
// coast-glow paint expressions in 01-core.js so all three read as one
// transition rather than independently-tuned effects.
map.on("zoom", () => {
  const z = map.getZoom ? map.getZoom() : 2;
  const fx = Math.max(0, Math.min(1, 1 - (z - 3) / 3));
  document.documentElement.style.setProperty("--bg-fx", fx.toFixed(2));
});
