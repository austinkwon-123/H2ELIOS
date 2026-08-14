const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const { LAYERS, normalizeFeature, onlineYear } = require("../build-h2inframap.js");

test("commissioning text resolves to the first usable target year", () => {
  assert.equal(onlineYear("Early 2030s"), 2030);
  assert.equal(onlineYear("2027 / 2028"), 2027);
  assert.equal(onlineYear("No data available"), null);
});

test("source records retain provider fields and gain the map contract", () => {
  const layer = LAYERS.find((entry) => entry.key === "transmission");
  const normalized = normalizeFeature({
    type: "Feature",
    geometry: { type: "LineString", coordinates: [[4, 51], [5, 52]] },
    properties: {
      OBJECTID: 17,
      Project_Na: "Test route",
      Promoter_N: "Test TSO",
      Project_Ty: "New",
      Commission: "2030",
      Increment: "120",
      Website: "https://example.com/project",
      Description: "Source description",
      Shape__Length: 500000
    }
  }, layer);

  assert.equal(normalized.properties.Project_Na, "Test route");
  assert.equal(normalized.properties.name, "Test route");
  assert.equal(normalized.properties.category, "pipeline");
  assert.equal(normalized.properties.capacity, "120 GWh/day increment");
  assert.equal(normalized.properties.onlineYear, 2030);
  assert.equal(normalized.properties.approx, 1);
  assert.equal(normalized.properties.scale, 6);
  assert.equal(normalized.properties.dataSource, "h2inframap");
});

test("generated snapshot is complete and integrates only real infrastructure", () => {
  const filename = path.join(__dirname, "..", "js", "h2inframap-data.js");
  const source = fs.readFileSync(filename, "utf8");
  const target = {
    production: { type: "FeatureCollection", features: [] },
    endUse: { type: "FeatureCollection", features: [] },
    storagePoints: { type: "FeatureCollection", features: [] },
    pipelines: { type: "FeatureCollection", features: [] }
  };
  const context = vm.createContext({ window: { HYDROGEN_DATA: target }, Set, Object });
  vm.runInContext(source, context, { filename });

  const data = context.window.H2INFRAMAP_DATA;
  const sourceCount = Object.values(data.layers)
    .reduce((sum, collection) => sum + collection.features.length, 0);

  assert.equal(sourceCount, 707);
  assert.equal(data.metadata.includedLayers.length, 6);
  assert.deepEqual(
    Array.from(data.metadata.excludedLayers, (layer) => layer.name),
    ["Capitals", "BigCities"]
  );
  assert.equal(data.metadata.licenseInfo, null);
  assert.equal(data.metadata.termsOfUse, null);
  assert.ok(context.window.H2INFRAMAP_INTEGRATION.points > 400);
  assert.ok(context.window.H2INFRAMAP_INTEGRATION.pipelineSegments > 600);
  assert.ok(target.pipelines.features.every((feature) => feature.geometry.type === "LineString"));
  const ribbons3d = target.pipelines.features.filter((feature) => feature.properties.h2infraRibbon3d);
  assert.ok(ribbons3d.length >= 50 && ribbons3d.length <= 100);
  assert.ok(target.pipelines.features.some((feature) => feature.properties.h2infraRibbon3d === false));
  assert.ok(target.production.features.every((feature) => feature.properties.dataSource === "h2inframap"));
});
