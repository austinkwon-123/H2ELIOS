/* H2ELIOS offline map adapter.
   The application shell, search, registry and calculators must remain usable
   when the CDN-hosted MapLibre runtime is blocked. This tiny stateful adapter
   implements only the public methods H2ELIOS calls; it never attempts to draw
   a substitute map. The real MapLibre object always wins when available. */
(function installMapLibreFallback() {
  if (window.maplibregl) return;

  class OfflineSource {
    constructor(definition = {}) { this.definition = definition; this.data = definition.data; }
    setData(data) { this.data = data; return this; }
  }

  class OfflineMap {
    constructor(options = {}) {
      this.options = options;
      this._sources = new Map();
      this._layers = new Map();
      this._events = new Map();
      this._center = { lng: options.center?.[0] || 0, lat: options.center?.[1] || 0 };
      this._zoom = options.zoom || 0;
      this._pitch = options.pitch || 0;
      this._bearing = options.bearing || 0;
      this._padding = { top: 0, right: 0, bottom: 0, left: 0 };
      this._sky = options.style?.sky || null;
      this._loaded = false;
      this._canvas = document.createElement("canvas");
      document.getElementById(options.container)?.setAttribute("data-map-offline", "true");
      (options.style?.sources ? Object.entries(options.style.sources) : []).forEach(([id, source]) => this.addSource(id, source));
      (options.style?.layers || []).forEach((layer) => this.addLayer(layer));
      const markReady = () => {
        this._loaded = true;
        this._emit("styledata");
        this._emit("load");
      };
      // Deferred by a macrotask past DOMContentLoaded on purpose. The shell
      // registers its own map.on("load", ...) handlers from inside a
      // DOMContentLoaded listener, so emitting during that same event would
      // fire "load" before those handlers exist and they would never run.
      const scheduleReady = () => setTimeout(markReady, 0);
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", scheduleReady, { once: true });
      else scheduleReady();
    }
    on(type, layerOrHandler, maybeHandler) {
      const handler = typeof layerOrHandler === "function" ? layerOrHandler : maybeHandler;
      if (typeof handler !== "function") return this;
      if (!this._events.has(type)) this._events.set(type, []);
      this._events.get(type).push(handler);
      // "load" and "styledata" are one-shot readiness signals here, and callers
      // register them from all over the boot sequence. Replaying them to a
      // late subscriber makes readiness independent of registration order,
      // rather than silently dropping every handler added after we went ready.
      if (this._loaded && (type === "load" || type === "styledata")) setTimeout(() => handler({}), 0);
      return this;
    }
    once(type, handler) {
      const wrapped = (...args) => { this.off(type, wrapped); handler(...args); };
      return this.on(type, wrapped);
    }
    off(type, handler) {
      this._events.set(type, (this._events.get(type) || []).filter((fn) => fn !== handler));
      return this;
    }
    _emit(type, payload = {}) { (this._events.get(type) || []).slice().forEach((fn) => fn(payload)); }
    addSource(id, definition) { if (!this._sources.has(id)) this._sources.set(id, new OfflineSource(definition)); return this; }
    getSource(id) { return this._sources.get(id); }
    addLayer(layer) { if (!this._layers.has(layer.id)) this._layers.set(layer.id, { ...layer, layout: { ...(layer.layout || {}) }, paint: { ...(layer.paint || {}) } }); return this; }
    moveLayer() { return this; }
    getLayer(id) { return this._layers.get(id); }
    setLayoutProperty(id, key, value) { const layer = this.getLayer(id); if (layer) layer.layout[key] = value; return this; }
    getLayoutProperty(id, key) { return this.getLayer(id)?.layout?.[key]; }
    setPaintProperty(id, key, value) { const layer = this.getLayer(id); if (layer) layer.paint[key] = value; return this; }
    getPaintProperty(id, key) { return this.getLayer(id)?.paint?.[key]; }
    setFilter(id, value) { const layer = this.getLayer(id); if (layer) layer.filter = value; return this; }
    addControl(control) { control?.onAdd?.(this); return this; }
    setSky(sky) { this._sky = sky; return this; }
    setLight() { return this; }
    getSky() { return this._sky; }
    setPadding(padding) { this._padding = { ...this._padding, ...padding }; return this; }
    getPadding() { return { ...this._padding }; }
    flyTo(options = {}) { return this._applyView(options); }
    easeTo(options = {}) { return this._applyView(options); }
    jumpTo(options = {}) { return this._applyView(options); }
    _applyView(options) {
      if (options.center) this._center = { lng: options.center[0], lat: options.center[1] };
      if (options.zoom != null) this._zoom = options.zoom;
      if (options.pitch != null) this._pitch = options.pitch;
      if (options.bearing != null) this._bearing = options.bearing;
      return this;
    }
    zoomIn() { this._zoom += 1; return this; }
    zoomOut() { this._zoom -= 1; return this; }
    getCenter() { return { ...this._center }; }
    getZoom() { return this._zoom; }
    getPitch() { return this._pitch; }
    getBearing() { return this._bearing; }
    getBounds() { return { getWest: () => -180, getEast: () => 180, getSouth: () => -90, getNorth: () => 90 }; }
    project(point) { const lng = point.lng ?? point[0], lat = point.lat ?? point[1]; return { x: (lng + 180) / 360 * innerWidth, y: (90 - lat) / 180 * innerHeight }; }
    unproject(point) { return { lng: point[0] / innerWidth * 360 - 180, lat: 90 - point[1] / innerHeight * 180 }; }
    queryRenderedFeatures() { return []; }
    getCanvas() { return this._canvas; }
    getStyle() { return { sources: Object.fromEntries(this._sources), layers: Array.from(this._layers.values()) }; }
    isStyleLoaded() { return this._loaded; }
    loaded() { return this._loaded; }
    resize() { return this; }
    triggerRepaint() { return this; }
  }

  class OfflinePopup {
    setLngLat(value) { this.lngLat = value; return this; }
    setHTML(value) { this.html = value; return this; }
    addTo() { return this; }
    remove() { return this; }
  }

  class OfflineMarker {
    constructor(options = {}) { this.element = options.element; }
    setLngLat(value) { this.lngLat = value; return this; }
    addTo() { return this; }
    remove() { return this; }
  }

  window.maplibregl = {
    Map: OfflineMap,
    Popup: OfflinePopup,
    Marker: OfflineMarker,
    MercatorCoordinate: {
      fromLngLat({ lng, lat }) {
        const boundedLat = Math.max(-85.051129, Math.min(85.051129, lat));
        const x = (lng + 180) / 360;
        const sin = Math.sin(boundedLat * Math.PI / 180);
        return { x, y: 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI), z: 0, meterInMercatorCoordinateUnits: () => 1 / 40075016.686 };
      }
    }
  };
  document.documentElement.dataset.mapRuntime = "offline";

  // The shell, search, registry and calculators all still work, but the globe
  // does not: queryRenderedFeatures() returns nothing, so the map is inert.
  // Say so, rather than leaving an empty panel that looks like a hung load.
  const announceOfflineMap = () => {
    if (document.querySelector(".map-offline-notice")) return;
    const notice = document.createElement("div");
    notice.className = "map-offline-notice";
    notice.setAttribute("role", "status");
    notice.textContent = "Map runtime unavailable — the globe is disabled. Search, workspaces and calculators still work.";
    document.getElementById("map")?.appendChild(notice);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", announceOfflineMap, { once: true });
  else announceOfflineMap();
})();
