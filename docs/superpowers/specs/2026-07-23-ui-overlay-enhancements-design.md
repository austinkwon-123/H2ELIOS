# UI Overlay Enhancements — Design Spec

Date: 2026-07-23
Status: Approved by user

## Summary

Five overlay/control upgrades to the Map page HUD, plus a fix for the top
nav island overflowing into horizontal scroll on 9 tabs:

1. Custom styled tooltips (shared component) for the left layer-dock sidebar.
2. Merge the bottom filter dock (Status + Region) and the separate
   bottom-left color legend into one glassmorphism panel with a
   collapse/expand toggle.
3. A "Reset View" button under MapLibre's zoom controls (top-left).
4. Cmd/Ctrl+K hotkey to focus the network search input.
5. Icon-only top nav island (no more hover-expand labels, no more
   horizontal scroll) using the same shared tooltip component.

This is a pure UI/styling + small-interaction-JS pass. No changes to
filter logic, search logic, map data layers, or the router.

## Why this approach

- The codebase has no build step and no component framework (see
  README.md "Editing rules") — classic scripts, one global scope, CSS
  driven by the `:root` token system in `style.css`. All five features are
  built the same way: new CSS using existing `--panel`, `--cyan`, `--line`
  etc. tokens, plus small vanilla-JS wiring in the existing module files.
- Tooltips (#1 and #5) share one CSS component instead of two bespoke
  implementations, since both are "hover an icon, see its name."
- The filter panel merge (#2) reuses the existing `.seg-btn` /
  `.legend-dot` click handlers in `03-filters.js` untouched — this is a
  markup/layout move, not a logic rewrite.

## Design

### 1. Shared tooltip component (new CSS, `style.css`)

```css
.has-tip { position: relative; }
.has-tip::after {
  content: attr(data-tip);
  position: absolute;
  padding: 5px 9px;
  background: var(--panel-strong);
  backdrop-filter: blur(var(--panel-blur));
  border: 1px solid var(--line);
  border-radius: var(--r-sm);
  color: var(--text-hi);
  font-size: 10.5px;
  white-space: nowrap;
  opacity: 0;
  pointer-events: none;
  transform: translateY(2px);
  transition: opacity 0.15s ease 0.1s, transform 0.15s ease 0.1s;
  z-index: 1200;
}
.has-tip:hover::after, .has-tip:focus-visible::after {
  opacity: 1;
  transform: translateY(0);
}
/* placement variants */
.tip-right::after { left: calc(100% + 10px); top: 50%; transform: translateY(-50%) translateX(-2px); }
.tip-right:hover::after, .tip-right:focus-visible::after { transform: translateY(-50%) translateX(0); }
.tip-bottom::after { top: calc(100% + 8px); left: 50%; transform: translateX(-50%) translateY(-2px); }
.tip-bottom:hover::after, .tip-bottom:focus-visible::after { transform: translateX(-50%) translateY(0); }
```

Every trigger element keeps a real `aria-label` (screen-reader name) in
addition to `data-tip` (visual tooltip text) — same string, two
mechanisms, so accessibility doesn't depend on the CSS having loaded.

### 2. Sidebar tooltips (`#layer-dock`, `index.html` + `style.css`)

Each `.dock-btn` currently has `title="..."`. Replace with:

```html
<button class="dock-btn active tip-right has-tip" data-layer="upstream"
        aria-label="Upstream energy sources" data-tip="Upstream energy sources">
```

(`title` removed — the custom tooltip replaces it; keeping both would show
two tooltips.) Twelve buttons, same treatment.

### 3. Glassmorphism filter panel (`index.html` + `style.css` + small JS)

Replace the current `#filter-dock` (Status + Region only) and `#legend`
(Color Type) with one panel:

```html
<div class="glass" id="filter-dock">
  <button id="filter-toggle" aria-expanded="true" aria-controls="filter-body" title="Collapse filters">
    <svg ...chevron.../>
  </button>
  <div id="filter-body">
    <div class="filter-row">
      <span class="filter-label">Status</span>
      <div class="seg-group" id="status-seg">...(unchanged buttons)...</div>
    </div>
    <div class="filter-row">
      <span class="filter-label">Region</span>
      <div class="seg-group" id="region-seg">...(unchanged buttons)...</div>
    </div>
    <div class="filter-row">
      <span class="filter-label">Color</span>
      <div class="seg-group" id="color-seg">...(existing .legend-dot buttons, unchanged data-color attrs)...</div>
    </div>
  </div>
</div>
```

- `#filter-dock` CSS: `background: rgba(8,12,20,0.55); backdrop-filter:
  blur(10px) saturate(140%);` — new panel-specific values per the user's
  spec (distinct from but consistent with the existing `--panel-strong`
  family), `border-radius: var(--r-lg)`, positioned bottom-center as
  today.
- `#filter-toggle` (new, small JS in `03-filters.js`): click toggles a
  `.collapsed` class on `#filter-dock`. Collapsed state: `#filter-body`
  collapses via `max-height` transition to 0/hidden, panel shrinks to a
  thin bar showing just the toggle chevron (rotated 180°) + a text pill
  summarizing active filter count (e.g. "2 filters active"), computed by
  counting `.seg-btn.active:not([data-status="all"])` +
  `.seg-btn.active:not([data-region="all"])` + `.legend-dot.active`
  occurrences at toggle time (recomputed on every filter click too, so
  the collapsed summary stays live).
- No existing `data-status`/`data-region`/`data-color` handlers in
  `03-filters.js` change — only their container markup moves.
- Old `#legend` element and its standalone CSS block are removed (folded
  into `#filter-dock`).

### 4. Map controls: Reset View (`js/01-core.js`)

New custom MapLibre control, added right after the existing
`NavigationControl`:

```js
class ResetViewControl {
  onAdd(map) {
    this._map = map;
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";
    const btn = document.createElement("button");
    btn.className = "tip-right has-tip";
    btn.setAttribute("aria-label", "Reset view");
    btn.setAttribute("data-tip", "Reset view");
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" ...home-icon path.../>`;
    btn.onclick = () => map.flyTo({ center: [15, 20], zoom: 1.7, pitch: 58, bearing: 12, duration: 1200 });
    this._container.appendChild(btn);
    return this._container;
  }
  onRemove() { this._container.remove(); this._map = undefined; }
}
map.addControl(new ResetViewControl(), "top-left");
```

Added as a separate `top-left` control (MapLibre stacks same-corner
controls vertically automatically), so it renders directly under the
zoom +/- buttons with matching `.maplibregl-ctrl-group` chrome — no
manual CSS offset needed. The 6 literal camera values match `01-core.js`'s
`map` constructor exactly (see current file: `center:[15,20], zoom:1.7,
pitch:58, bearing:12`); if that initial view ever changes, update both
places together (left as a plain duplication rather than a shared const,
consistent with how the rest of this file already inlines map config).

### 5. Search hotkey + rename (`index.html`, `style.css`, `js/04-search.js`)

- Rename `id="search-box"` → `id="network-search"` in `index.html`.
- Update the one CSS selector block (`#search-box { ... }`,
  `#search-capsule:hover #search-box` etc.) in `style.css` to
  `#network-search`.
- Update the `getElementById("search-box")` reference(s) in
  `js/04-search.js` to `"network-search"`.
- New listener (in `js/04-search.js`, near existing search init code):

```js
document.addEventListener("keydown", (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    const input = document.getElementById("network-search");
    input.focus();
    input.select();
  }
});
```

Focusing the input triggers the existing `#search-capsule:focus-within`
CSS rule, so the island auto-expands — no extra JS needed for that part.

### 6. Icon-only top nav island (`index.html` + `style.css`)

- `#tab-nav`: remove the `overflow-x: auto` and the hover/focus-within
  rule that expands `.tab-btn span` to `max-width: 160px`. Labels stay
  `max-width: 0; opacity: 0` permanently, **except** `.tab-btn.active
  span`, which keeps its current expand-to-label behavior (so the active
  page name stays visible as a permanent chip).
- Each `.tab-btn` gets `tip-bottom has-tip` classes, `aria-label` (already
  has readable text in the `<span>`, reused as the label string) and
  `data-tip` matching.
- Because every non-active tab is now icon-only, `#tab-nav`'s natural
  width drops well under its current `max-width: min(60vw, 720px)` cap for
  all 9 tabs — no scroll container needed. `max-width`/`overflow-x` rules
  can be dropped entirely rather than just raised, since icon-only content
  is bounded and small by construction.

## Non-goals

- No localStorage persistence for the filter-panel collapse state (resets
  each page load, consistent with how every other panel's visibility
  already works in this app).
- No changes to `applyFilters`, `TOGGLE_MAP`, region/status/color
  filtering logic itself.
- No changes to search matching/ranking logic in `04-search.js` beyond the
  id rename and the new listener.
- Not touching the "More ▾" pattern or any other overflow strategy for the
  nav island — icon-only was the chosen fix.
