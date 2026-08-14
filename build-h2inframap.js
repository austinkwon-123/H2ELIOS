// Regenerates js/h2inframap-data.js from the public ArcGIS FeatureServer used
// by h2inframap.eu. The website labels project positions as indicative, so the
// generated bundle keeps that qualification alongside the source metadata and
// marks every imported record approximate. No published licence is attached to
// the ArcGIS items; that fact is recorded rather than silently implying one.

const fs = require("node:fs");
const path = require("node:path");

const SOURCE_SITE = "https://www.h2inframap.eu/";
const VIEWER_ITEM_ID = "406fcfc1e7824b7eb60e04cfd1329d0b";
const WEB_MAP_ITEM_ID = "053ad0c8c3b74ff59128ca7cbc32c227";
const SERVICE_URL = "https://services9.arcgis.com/xSsJeibXqRtsnmY7/arcgis/rest/services/Hydrogen_Infrastructure_Map_2024Q4_WFL1/FeatureServer";
const PAGE_SIZE = 1000;
const OUTPUT_PATH = path.join(__dirname, "js", "h2inframap-data.js");

const LAYERS = [
  { id: 0, key: "distribution", name: "Distribution" },
  { id: 1, key: "demandProduction", name: "Demand and Production" },
  { id: 2, key: "terminalsPorts", name: "Terminals and Ports" },
  { id: 3, key: "storage", name: "Storage" },
  { id: 6, key: "highPressureDistribution", name: "High Pressure Distribution" },
  { id: 7, key: "transmission", name: "Transmission" }
];

function useful(value) {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return Boolean(text) && !/^(?:n\/?a|no data available|not available|none)$/i.test(text);
}

function firstUseful(...values) {
  return values.find(useful);
}

function commissioning(raw) {
  return firstUseful(raw.Commissioning_Year_First, raw.Commission) || "";
}

function onlineYear(value) {
  // "Early 2030s" is used by the source for decade-level targets. Capture the
  // first four digits without requiring a trailing word boundary so that the
  // timeline can place that record at the start of its stated decade.
  const match = String(value || "").match(/\b(20[2-5]\d)(?!\d)/);
  return match ? Number(match[1]) : null;
}

function normalizedCategory(layer, raw) {
  if (layer.key === "demandProduction") {
    return /^demand$/i.test(raw.Project_Type || "") ? "end_use" : "production";
  }
  if (layer.key === "terminalsPorts") return "terminal";
  if (layer.key === "storage") return "storage";
  if (layer.key === "distribution") return "distribution";
  return "pipeline";
}

function subtype(layer, raw) {
  if (layer.key === "demandProduction") {
    return firstUseful(raw.Production_category, raw.End_use_category, raw.Project_Type) || layer.name;
  }
  if (layer.key === "terminalsPorts") {
    const carrier = firstUseful(raw.Hydrogen_Derivate, raw.Carrier_Type);
    return carrier ? `${carrier} terminal / port` : "Hydrogen terminal / port";
  }
  if (layer.key === "storage") return firstUseful(raw.Storage_Ty, raw.Project_Ty) || "Hydrogen storage";
  if (layer.key === "distribution") return firstUseful(raw.Project_Ty) || "Hydrogen distribution project";
  return `${layer.name} · ${firstUseful(raw.Project_Ty) || "Hydrogen pipeline"}`;
}

function capacity(layer, raw) {
  if (layer.key === "demandProduction") {
    if (useful(raw.Capacity__MW)) return `${raw.Capacity__MW} MW`;
    if (useful(raw.Expected_carrier_yearly_volume_)) return `${raw.Expected_carrier_yearly_volume_} GWh/year`;
  }
  if (layer.key === "terminalsPorts") {
    if (useful(raw.Daily_Send_out_capacity__GWh)) return `${raw.Daily_Send_out_capacity__GWh} GWh/day send-out`;
    if (useful(raw.Total_storage_capacity__GWh)) return `${raw.Total_storage_capacity__GWh} GWh storage`;
    if (useful(raw.Expected_yearly_volume__GWh_yea)) return `${raw.Expected_yearly_volume__GWh_yea} GWh/year`;
  }
  if (layer.key === "storage") {
    if (useful(raw.Storage_wo)) return `${raw.Storage_wo} GWh working volume`;
    if (useful(raw.Withdrawal)) return `${raw.Withdrawal} GWh/day withdrawal`;
  }
  if (useful(raw.Increment)) return `${raw.Increment} GWh/day increment`;
  if (useful(raw.Peak_Incre)) return `${raw.Peak_Incre} GWh/day peak increment`;
  return "Not disclosed";
}

function scale(layer, raw) {
  const lineLengthKm = Number(raw.Shape__Length) / 1000;
  if (Number.isFinite(lineLengthKm) && lineLengthKm > 0) {
    if (lineLengthKm >= 1000) return 7;
    if (lineLengthKm >= 500) return 6;
    if (lineLengthKm >= 250) return 5;
    if (lineLengthKm >= 100) return 4;
    return 3;
  }

  const numericCapacity = Number.parseFloat(firstUseful(
    raw.Capacity__MW,
    raw.Expected_carrier_yearly_volume_,
    raw.Expected_yearly_volume__GWh_yea,
    raw.Total_storage_capacity__GWh,
    raw.Storage_wo,
    raw.Increment
  ));
  if (!Number.isFinite(numericCapacity)) return 2;
  if (numericCapacity >= 10000) return 7;
  if (numericCapacity >= 1000) return 6;
  if (numericCapacity >= 250) return 5;
  if (numericCapacity >= 50) return 4;
  if (numericCapacity >= 10) return 3;
  return 2;
}

function normalizeFeature(feature, layer) {
  const raw = feature.properties || {};
  const target = commissioning(raw);
  const year = onlineYear(target);
  const name = firstUseful(raw.Project_Name, raw.Project_Na) || `${layer.name} ${raw.OBJECTID || "record"}`;
  const maturity = firstUseful(raw.Maturity_Status, raw.Maturity_S);
  const status = maturity || (target ? `Announced · target ${target}` : "Announced");

  return {
    type: "Feature",
    id: `${layer.id}:${raw.OBJECTID || name}`,
    geometry: feature.geometry || null,
    properties: {
      ...raw,
      name,
      category: normalizedCategory(layer, raw),
      subtype: subtype(layer, raw),
      color: "gray_blue",
      capacity: capacity(layer, raw),
      status,
      statusClass: /cancel|suspend|delay|less-advanced/i.test(status) ? "atrisk" : "planned",
      scale: scale(layer, raw),
      region: "europe",
      operator: firstUseful(raw.Promoter_Name, raw.Promoter_N) || "Not disclosed",
      source: useful(raw.Website) ? raw.Website : SOURCE_SITE,
      updated: target ? `Target ${target}` : "H2InfraMap 2024 Q4",
      date: target,
      onlineYear: year,
      note: firstUseful(raw.Description, raw.Descriptio) || "",
      approx: 1,
      tier: "h2inframap",
      dataSource: "h2inframap",
      h2infraLayer: layer.name,
      h2infraObjectId: raw.OBJECTID,
      h2infraLocation: firstUseful(raw.Location) || "",
      h2infraPciPmi: firstUseful(raw.PCI_PMI) || ""
    }
  };
}

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: "application/geo+json, application/json" } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  const json = await response.json();
  if (json.error) throw new Error(`ArcGIS ${json.error.code}: ${json.error.message}`);
  return json;
}

async function fetchLayer(layer) {
  const countParams = new URLSearchParams({ where: "1=1", returnCountOnly: "true", f: "json" });
  const countResult = await getJson(`${SERVICE_URL}/${layer.id}/query?${countParams}`);
  const features = [];

  for (let offset = 0; offset < countResult.count; offset += PAGE_SIZE) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "*",
      returnGeometry: "true",
      outSR: "4326",
      orderByFields: "OBJECTID ASC",
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
      f: "geojson"
    });
    const page = await getJson(`${SERVICE_URL}/${layer.id}/query?${params}`);
    features.push(...(page.features || []));
  }

  if (features.length !== countResult.count) {
    throw new Error(`${layer.name}: expected ${countResult.count} records, received ${features.length}`);
  }

  return {
    type: "FeatureCollection",
    features: features.map((feature) => normalizeFeature(feature, layer))
  };
}

function browserIntegrationSource() {
  return `
// Keep the source collections intact, then append normalized records to the
// existing H2ELIOS collections. Multi-part network projects become individual
// LineStrings only in memory because MapLibre's custom 3D layer draws routes,
// while the stored snapshot must preserve the provider's original geometry.
window.H2INFRAMAP_DATA.integrate = function integrateH2InfraMap(target) {
  if (!target || target.__h2InfraMapSnapshot === window.H2INFRAMAP_DATA.metadata.snapshotId) {
    return { added: 0, skipped: 0, alreadyIntegrated: Boolean(target) };
  }

  var stats = { added: 0, skipped: 0, points: 0, pipelineSegments: 0 };
  var layers = window.H2INFRAMAP_DATA.layers;

  function nameKey(feature) {
    return String(feature && feature.properties && feature.properties.name || "").trim().toLowerCase();
  }

  function appendUniquePoints(destination, incoming) {
    if (!destination || !Array.isArray(destination.features)) return;
    var names = new Set(destination.features.map(nameKey));
    incoming.forEach(function (feature) {
      var key = nameKey(feature);
      if (!feature.geometry || feature.geometry.type !== "Point" || !key || names.has(key)) {
        stats.skipped += 1;
        return;
      }
      destination.features.push(feature);
      names.add(key);
      stats.added += 1;
      stats.points += 1;
    });
  }

  function lineParts(feature) {
    if (!feature.geometry) return [];
    if (feature.geometry.type === "LineString") return [feature.geometry.coordinates];
    if (feature.geometry.type === "MultiLineString") return feature.geometry.coordinates;
    return [];
  }

  function routeLengthScore(coordinates) {
    var score = 0;
    for (var index = 1; index < coordinates.length; index += 1) {
      var previous = coordinates[index - 1];
      var current = coordinates[index];
      score += Math.hypot(current[0] - previous[0], current[1] - previous[1]);
    }
    return score;
  }

  function appendPipelineProjects(destination, incoming) {
    if (!destination || !Array.isArray(destination.features)) return;
    var curatedNames = new Set(destination.features.map(nameKey));
    incoming.forEach(function (feature) {
      if (curatedNames.has(nameKey(feature))) {
        stats.skipped += 1;
        return;
      }
      var parts = lineParts(feature);
      // The source stores national networks as hundreds of multipart fragments.
      // Raising every fragment produces a white wall over Europe and hundreds
      // of WebGL draw calls. The 2D layer keeps every path; 3D uses the longest
      // representative path only for corridors whose reported total length is
      // at least 250 km. Existing curated ribbons remain unaffected.
      var reportedLength = Number(feature.properties.Shape__Length) || 0;
      var ribbonPart = -1;
      if (reportedLength >= 250000 && parts.length) {
        ribbonPart = parts.reduce(function (best, coordinates, index) {
          return routeLengthScore(coordinates) > routeLengthScore(parts[best]) ? index : best;
        }, 0);
      }
      parts.forEach(function (coordinates, segmentIndex) {
        if (!Array.isArray(coordinates) || coordinates.length < 2) return;
        destination.features.push({
          type: "Feature",
          id: String(feature.id) + ":" + segmentIndex,
          geometry: { type: "LineString", coordinates: coordinates },
          properties: Object.assign({}, feature.properties, {
            h2infraSegment: segmentIndex + 1,
            h2infraRibbon3d: segmentIndex === ribbonPart
          })
        });
        stats.added += 1;
        stats.pipelineSegments += 1;
      });
    });
  }

  appendUniquePoints(target.production, layers.demandProduction.features.filter(function (feature) {
    return feature.properties.category === "production";
  }));
  appendUniquePoints(target.endUse, layers.demandProduction.features.filter(function (feature) {
    return feature.properties.category === "end_use";
  }));
  appendUniquePoints(target.endUse, layers.distribution.features);
  appendUniquePoints(target.storagePoints, layers.terminalsPorts.features);
  appendUniquePoints(target.storagePoints, layers.storage.features);
  appendPipelineProjects(target.pipelines, layers.highPressureDistribution.features);
  appendPipelineProjects(target.pipelines, layers.transmission.features);

  Object.defineProperty(target, "__h2InfraMapSnapshot", {
    value: window.H2INFRAMAP_DATA.metadata.snapshotId,
    configurable: true
  });
  return stats;
};

window.H2INFRAMAP_INTEGRATION = window.H2INFRAMAP_DATA.integrate(window.HYDROGEN_DATA);
`;
}

function renderBundle(snapshot) {
  return `// GENERATED by build-h2inframap.js — do not hand-edit.\n` +
    `// Public ArcGIS snapshot; coordinates are approximate/indicative.\n` +
    `window.H2INFRAMAP_DATA = ${JSON.stringify(snapshot)};\n` +
    browserIntegrationSource();
}

async function build() {
  const retrievedAt = new Date().toISOString();
  const entries = await Promise.all(LAYERS.map(async (layer) => [layer.key, await fetchLayer(layer)]));
  const layers = Object.fromEntries(entries);
  const snapshot = {
    metadata: {
      schemaVersion: 1,
      snapshotId: `h2inframap-${retrievedAt.slice(0, 10)}`,
      retrievedAt,
      sourceSite: SOURCE_SITE,
      viewerItemId: VIEWER_ITEM_ID,
      webMapItemId: WEB_MAP_ITEM_ID,
      serviceUrl: SERVICE_URL,
      serviceLabel: "Hydrogen Infrastructure Map 2024Q4 WFL1",
      access: "public",
      licenseInfo: null,
      termsOfUse: null,
      locationPrecision: "Approximate and indicative; verify against the project promoter or primary source.",
      renderingPolicy: "All source paths render in 2D; 3D uses one representative path for corridors at least 250 km long.",
      includedLayers: LAYERS.map(({ id, key, name }) => ({ id, key, name, count: layers[key].features.length })),
      excludedLayers: [
        { id: 4, name: "Capitals", reason: "Basemap decoration, not hydrogen infrastructure" },
        { id: 5, name: "BigCities", reason: "Basemap decoration, not hydrogen infrastructure" }
      ]
    },
    layers
  };

  fs.writeFileSync(OUTPUT_PATH, renderBundle(snapshot), "utf8");
  const total = Object.values(layers).reduce((sum, collection) => sum + collection.features.length, 0);
  console.log(`Wrote ${path.relative(__dirname, OUTPUT_PATH)} with ${total} source records.`);
  LAYERS.forEach((layer) => console.log(`  ${layer.name}: ${layers[layer.key].features.length}`));
}

if (require.main === module) {
  build().catch((error) => {
    console.error(error.stack || error);
    process.exitCode = 1;
  });
}

module.exports = {
  LAYERS,
  normalizeFeature,
  onlineYear,
  renderBundle,
  useful
};
