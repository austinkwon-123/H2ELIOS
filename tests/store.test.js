const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// The app writes hashes as "#/map" — with the slash. The previous default here
// was "#map", a shape the router never produces, which is why the store's
// slice(1) hash parsing looked correct under test while every real deep link
// silently initialised the route to "map".
function createStore(hash = "#/map") {
  const values = new Map();
  const window = {
    location: { hash },
    localStorage: {
      getItem: (key) => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value))
    },
    console
  };
  const context = vm.createContext({ window, console, Date, Object, Array, Number, String, Boolean, Math, Set, Map });
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "store.js"), "utf8");
  vm.runInContext(source, context, { filename: "store.js" });
  return window;
}

test("fresh state follows the system theme, is map-routed, and has four active layer groups", () => {
  const { H2Store } = createStore();
  const state = H2Store.getState();
  // "system", not "dark": initSpatialShell reads the same localStorage key with
  // `|| "system"`, so a store defaulting to "dark" described a theme the app
  // was not applying for any first-time visitor on a light OS.
  assert.equal(state.theme, "system");
  assert.equal(state.route, "map");
  assert.deepEqual(
    Object.entries(state.map.layers).filter(([, active]) => active).map(([key]) => key),
    ["facilities", "pipelines", "hubs", "announced"]
  );
});

test("a stored theme preference still wins over the system default", () => {
  const { H2Store } = createStore();
  H2Store.dispatch({ type: "THEME_CHANGE", payload: { theme: "light" } });
  assert.equal(H2Store.getState().theme, "light");
});

test("deep links initialise the route instead of falling back to map", () => {
  // Regression: hash routes carry a leading slash, and "companies" was absent
  // from the route list used at init even though the reducer accepted it.
  assert.equal(createStore("#/policy").H2Store.getState().route, "policy");
  assert.equal(createStore("#/companies").H2Store.getState().route, "companies");
  assert.equal(createStore("#/demand-transport").H2Store.getState().route, "demand-transport");
  // Tolerate the slashless form too, since it costs nothing and old links exist.
  assert.equal(createStore("#technology").H2Store.getState().route, "technology");
  // Anything unrecognised still lands on the map.
  assert.equal(createStore("#/not-a-route").H2Store.getState().route, "map");
  assert.equal(createStore("").H2Store.getState().route, "map");
});

test("dispatch notifies selector subscribers and unsubscribe stops notifications", () => {
  const { H2Store } = createStore();
  const changes = [];
  const unsubscribe = H2Store.subscribe((state) => state.timelineYear, (next, previous) => changes.push([next, previous]));
  H2Store.dispatch({ type: "TIMELINE_YEAR_UPDATE", payload: { year: 2030 } });
  H2Store.dispatch({ type: "ROUTE_CHANGE", payload: { route: "timeline" } });
  unsubscribe();
  H2Store.dispatch({ type: "TIMELINE_YEAR_UPDATE", payload: { year: 2031 } });
  assert.deepEqual(changes, [[2030, 2026]]);
});

test("comparison tray is session-only and capped at three newest snapshots", () => {
  const { H2Store } = createStore();
  for (let index = 1; index <= 4; index += 1) {
    const snapshot = H2Store.createSnapshot("project", { id: `p${index}`, label: `Project ${index}`, payload: { index } });
    H2Store.dispatch({ type: "COMPARISON_ADD", payload: { snapshot } });
  }
  assert.deepEqual(Array.from(H2Store.getState().comparisons, (item) => item.id), ["p2", "p3", "p4"]);
  H2Store.dispatch({ type: "COMPARISON_REMOVE", payload: { id: "p3" } });
  assert.deepEqual(Array.from(H2Store.getState().comparisons, (item) => item.id), ["p2", "p4"]);
});

test("H2GSelection compatibility writes through the store", () => {
  const window = createStore();
  window.H2GSelection = { props: { name: "Test project" }, lngLat: [10, 20] };
  assert.equal(window.H2Store.getState().selection.props.name, "Test project");
  assert.deepEqual(Array.from(window.H2GSelection.lngLat), [10, 20]);
  window.H2GSelection = null;
  assert.equal(window.H2Store.getState().selection, null);
});

test("hand-off return restores route, filters and camera", () => {
  const { H2Store } = createStore("#technology");
  H2Store.dispatch({ type: "FILTER_UPDATE", payload: { filters: { region: "europe" } } });
  H2Store.dispatch({ type: "HANDOFF_BEGIN", payload: { fromRoute: "technology", label: "Technology", filters: H2Store.getState().filters, camera: { center: [9, 51], zoom: 4, pitch: 0, bearing: 0 } } });
  H2Store.dispatch({ type: "FILTER_UPDATE", payload: { filters: { region: "apac" } } });
  H2Store.dispatch({ type: "ROUTE_CHANGE", payload: { route: "map" } });
  H2Store.dispatch({ type: "HANDOFF_RETURN" });
  assert.equal(H2Store.getState().route, "technology");
  assert.equal(H2Store.getState().filters.region, "europe");
  assert.deepEqual(Array.from(H2Store.getState().map.camera.center), [9, 51]);
});
