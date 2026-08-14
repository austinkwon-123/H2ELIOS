/* ========================================================================== 
   H2ELIOS shared application store
   A small classic-script state seam for the existing vanilla application.
   It intentionally has no framework, module, or build-step dependency.
   ======================================================================= */
(function initH2Store(global) {
  "use strict";

  if (global.H2Store) return;

  const ACTIONS = Object.freeze({
    ROUTE_CHANGE: "ROUTE_CHANGE",
    THEME_CHANGE: "THEME_CHANGE",
    PROJECT_SELECT: "PROJECT_SELECT",
    PROJECT_CLEAR: "PROJECT_CLEAR",
    FILTER_UPDATE: "FILTER_UPDATE",
    TIMELINE_YEAR_UPDATE: "TIMELINE_YEAR_UPDATE",
    MAP_CAMERA_UPDATE: "MAP_CAMERA_UPDATE",
    MAP_LAYER_UPDATE: "MAP_LAYER_UPDATE",
    COMPARISON_ADD: "COMPARISON_ADD",
    COMPARISON_REMOVE: "COMPARISON_REMOVE",
    COMPARISON_CLEAR: "COMPARISON_CLEAR",
    HANDOFF_BEGIN: "HANDOFF_BEGIN",
    HANDOFF_RETURN: "HANDOFF_RETURN"
  });

  const PRIMARY_ROUTES = ["map", "market", "technology", "demand-transport", "policy", "timeline", "companies", "tools"];

  // Routes are written into the hash as "#/policy". Parsing with slice(1) left
  // "/policy", which matched nothing, so a deep link always initialised the
  // store to "map" while the shell rendered the correct workspace. This mirrors
  // currentWorkspaceRoute() in 23-spatial-shell.js so both agree on every path.
  function normalizeRoute(raw, fallback) {
    const route = String(raw == null ? "" : raw).replace(/^#?\/?/, "");
    return PRIMARY_ROUTES.includes(route) ? route : (fallback || "map");
  }

  const savedTheme = readThemePreference();
  let snapshotSequence = 0;
  let state = freezeState({
    route: normalizeRoute(global.location && global.location.hash),
    theme: savedTheme,
    selection: null,
    filters: { status: "all", region: "all", color: null, cohort: null },
    timelineYear: 2026,
    map: {
      // Mirrors H2GRID_HOME_VIEW in js/01-core.js — see the note there for why
      // the opening view is European. These two must not drift: this one seeds
      // the hand-off return camera, that one seeds the map itself.
      camera: { center: [9, 51], zoom: 1.85, pitch: 0, bearing: 8 },
      layers: { facilities: true, pipelines: true, fueling: false, hubs: true, announced: true },
      mode3d: false
    },
    handoff: null,
    comparisons: []
  });
  const subscriptions = new Set();

  // Defaults to "dark", matching initSpatialShell, which now seeds the shell
  // from this store with its own `|| "dark"` fallback. The store is the source
  // of truth for theme, so a first run must land on the product's default
  // rather than deferring to the OS.
  function readThemePreference() {
    try {
      const value = global.localStorage && global.localStorage.getItem("h2elios-theme");
      return value === "light" || value === "system" || value === "dark" ? value : "dark";
    } catch (error) {
      return "dark";
    }
  }

  function freezeState(next) {
    Object.freeze(next.filters);
    Object.freeze(next.map.camera.center);
    Object.freeze(next.map.camera);
    Object.freeze(next.map.layers);
    Object.freeze(next.map);
    Object.freeze(next.comparisons);
    return Object.freeze(next);
  }

  function cloneCamera(camera, fallback) {
    const source = camera || fallback || state.map.camera;
    const center = Array.isArray(source.center)
      ? [Number(source.center[0]), Number(source.center[1])]
      : Array.isArray(fallback && fallback.center) ? fallback.center.slice(0, 2) : state.map.camera.center.slice(0, 2);
    return {
      center,
      zoom: finiteOr(source.zoom, fallback && fallback.zoom, state.map.camera.zoom),
      pitch: finiteOr(source.pitch, fallback && fallback.pitch, state.map.camera.pitch),
      bearing: finiteOr(source.bearing, fallback && fallback.bearing, state.map.camera.bearing)
    };
  }

  function finiteOr() {
    for (let i = 0; i < arguments.length; i++) {
      const value = Number(arguments[i]);
      if (Number.isFinite(value)) return value;
    }
    return 0;
  }

  function normalizeSelection(payload) {
    if (!payload) return null;
    if (payload.props) {
      return {
        props: payload.props,
        lngLat: Array.isArray(payload.lngLat) ? payload.lngLat.slice(0, 2) : null
      };
    }
    if (payload.project) {
      return {
        props: payload.project,
        lngLat: Array.isArray(payload.coordinates) ? payload.coordinates.slice(0, 2) : null
      };
    }
    return null;
  }

  function normalizeHandoff(payload) {
    if (!payload) return null;
    return {
      fromRoute: normalizeRoute(payload.fromRoute, state.route),
      label: String(payload.label || "Previous workspace"),
      selectionId: payload.selectionId == null ? null : String(payload.selectionId),
      filters: { ...state.filters, ...(payload.filters || {}) },
      camera: cloneCamera(payload.camera, state.map.camera)
    };
  }

  function createSnapshot(type, payload) {
    const source = payload || {};
    snapshotSequence += 1;
    return Object.freeze({
      id: source.id || `${String(type || "snapshot")}-${Date.now()}-${snapshotSequence}`,
      type: String(type || "snapshot"),
      label: String(source.label || source.name || `Snapshot ${snapshotSequence}`),
      createdAt: Date.now(),
      payload: source.payload !== undefined ? source.payload : source
    });
  }

  function reduce(current, action) {
    const payload = action.payload !== undefined ? action.payload : action;
    switch (action.type) {
      case ACTIONS.ROUTE_CHANGE:
      case "route change": {
        return { ...current, route: normalizeRoute(payload.route || payload.value || payload) };
      }
      case ACTIONS.THEME_CHANGE:
      case "theme change": {
        const theme = String(payload.theme || payload.value || payload);
        if (!["dark", "light", "system"].includes(theme)) return current;
        try { global.localStorage && global.localStorage.setItem("h2elios-theme", theme); } catch (error) { /* storage may be unavailable */ }
        return { ...current, theme };
      }
      case ACTIONS.PROJECT_SELECT:
      case "project selection": {
        const selection = normalizeSelection(payload.selection || payload);
        return selection ? { ...current, selection } : current;
      }
      case ACTIONS.PROJECT_CLEAR:
      case "project clear":
        return current.selection ? { ...current, selection: null } : current;
      case ACTIONS.FILTER_UPDATE:
      case "filter update": {
        const updates = payload.filters || (payload.key ? { [payload.key]: payload.value } : payload);
        return { ...current, filters: { ...current.filters, ...updates } };
      }
      case ACTIONS.TIMELINE_YEAR_UPDATE:
      case "timeline-year update": {
        const year = Math.max(2020, Math.min(2050, Math.round(finiteOr(payload.year, payload.value, payload))));
        return year === current.timelineYear ? current : { ...current, timelineYear: year };
      }
      case ACTIONS.MAP_CAMERA_UPDATE:
      case "map-camera update":
        return { ...current, map: { ...current.map, camera: cloneCamera(payload.camera || payload, current.map.camera) } };
      case ACTIONS.MAP_LAYER_UPDATE:
      case "map-layer update": {
        const layers = payload.layers || (payload.key ? { [payload.key]: Boolean(payload.value) } : payload);
        return { ...current, map: { ...current.map, layers: { ...current.map.layers, ...layers } } };
      }
      case "MAP_3D_UPDATE":
        return { ...current, map: { ...current.map, mode3d: Boolean(payload.value !== undefined ? payload.value : payload) } };
      case ACTIONS.COMPARISON_ADD:
      case "comparison add": {
        const snapshot = payload.snapshot || (payload.id && payload.type ? payload : createSnapshot(payload.type, payload));
        const withoutDuplicate = current.comparisons.filter((item) => item.id !== snapshot.id);
        // The cap is per kind, not pooled. Projects pinned from the globe and
        // economics scenarios saved in the calculator share this one array, so
        // a single cap of 3 meant saving a third scenario silently evicted the
        // projects you were mid-comparison on — in a workspace you weren't
        // even looking at. Evict only same-kind entries, oldest first.
        const evicted = new Set(
          withoutDuplicate.filter((item) => item.type === snapshot.type).slice(0, -2).map((item) => String(item.id))
        );
        return {
          ...current,
          comparisons: withoutDuplicate.filter((item) => !evicted.has(String(item.id))).concat(snapshot)
        };
      }
      case ACTIONS.COMPARISON_REMOVE:
      case "comparison remove": {
        const id = String(payload.id || payload.value || payload);
        return { ...current, comparisons: current.comparisons.filter((item) => String(item.id) !== id) };
      }
      case ACTIONS.COMPARISON_CLEAR:
        return current.comparisons.length ? { ...current, comparisons: [] } : current;
      case ACTIONS.HANDOFF_BEGIN:
      case "hand-off begin":
        return { ...current, handoff: normalizeHandoff(payload.handoff || payload) };
      case ACTIONS.HANDOFF_RETURN:
      case "hand-off return": {
        if (!current.handoff) return current;
        return {
          ...current,
          route: current.handoff.fromRoute,
          filters: { ...current.handoff.filters },
          map: { ...current.map, camera: cloneCamera(current.handoff.camera, current.map.camera) },
          handoff: null
        };
      }
      default:
        return current;
    }
  }

  function dispatch(action) {
    if (!action || typeof action.type !== "string") throw new TypeError("H2Store.dispatch requires an action with a type");
    const previous = state;
    const reduced = reduce(previous, action);
    if (reduced === previous) return state;
    state = freezeState(reduced);
    subscriptions.forEach((subscription) => {
      let selected;
      try { selected = subscription.selector(state); } catch (error) { console.error("H2Store selector failed", error); return; }
      if (!Object.is(selected, subscription.value)) {
        const oldValue = subscription.value;
        subscription.value = selected;
        try { subscription.callback(selected, oldValue, state); } catch (error) { console.error("H2Store subscriber failed", error); }
      }
    });
    return state;
  }

  function subscribe(selector, callback) {
    if (typeof selector !== "function" || typeof callback !== "function") {
      throw new TypeError("H2Store.subscribe requires selector and callback functions");
    }
    const subscription = { selector, callback, value: selector(state) };
    subscriptions.add(subscription);
    return function unsubscribe() { subscriptions.delete(subscription); };
  }

  const api = Object.freeze({
    ACTIONS,
    getState: function getState() { return state; },
    dispatch,
    subscribe,
    createSnapshot
  });
  global.H2Store = api;

  // Temporary compatibility adapter. Legacy readers still see the historical
  // { props, lngLat } shape, but every write is routed through the store.
  try {
    Object.defineProperty(global, "H2GSelection", {
      configurable: true,
      enumerable: true,
      get: function getSelection() { return state.selection; },
      set: function setSelection(value) {
        dispatch(value
          ? { type: ACTIONS.PROJECT_SELECT, payload: value }
          : { type: ACTIONS.PROJECT_CLEAR });
      }
    });
  } catch (error) {
    global.H2GSelection = state.selection;
  }
})(window);
