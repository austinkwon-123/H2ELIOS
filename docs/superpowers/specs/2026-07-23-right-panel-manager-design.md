# Right-Side Panel Manager — Design Spec

Date: 2026-07-23
Status: Approved by user

## Summary

Three Map-page panels can currently appear on the right side of the
screen — `#detail-card` (click a facility), `#regional-ai-panel` (select
a region filter), and `#markets-panel` (click the ribbon's "Markets"
button, recently repositioned to bottom-right so it stops covering the
globe). `#detail-card` and `#regional-ai-panel` already force-close each
other via two separate hardcoded monkey-patches, but `#markets-panel` is
fully independent — it can be open at the same time as either of the
other two, and since it sits lower on the screen than the fixed
`top: 74px` the other two use, they can visually collide depending on
`#detail-card`'s actual rendered content height.

This spec makes all three panels **fully mutually exclusive** — opening
any one closes whichever of the other two is currently open — via one
shared coordinator function, replacing the two existing ad-hoc
monkey-patches rather than adding a third one alongside them. Since at
most one panel is ever visible now, all three also adopt one shared,
larger position/size slot instead of each having its own.

This is a layout/lifecycle-coordination pass. No changes to what any
panel *contains*, how facility/region/market data is fetched or
rendered, or the map's own filtering/interaction logic.

## Why this approach

- The existing bilateral exclusion (`js/16-ai-features.js` closes
  `#detail-card` when the AI panel opens; a separate monkey-patch on
  `showDetail` closes the AI panel when detail-card opens) is exactly
  the pattern needed for `#markets-panel` too, but duplicating it a
  third time would mean three call sites each hardcoding knowledge of
  the other two panels' ids — an O(n²) pattern that gets worse if a 4th
  panel is ever added. A single `closeOtherRightPanels(exceptId)`
  coordinator, called once per panel's open site, replaces both existing
  monkey-patches and the new Markets case with one small function that
  scales to N panels without new cross-references.
- A blind `panel.hidden = true` from the coordinator would be wrong for
  `#markets-panel` specifically — its own close path also stops an
  active polling interval (`stopMarketsPolling()`) and un-marks the
  ribbon button's `.active` state (`js/08-analytics.js`'s
  `wireMarketsToggle()`). If the coordinator only toggled `hidden`,
  closing Markets from another panel opening would leave that polling
  loop running invisibly in the background. Each panel therefore gets a
  real close *function* with its existing side effects intact, and the
  coordinator calls those functions instead of touching `hidden`
  directly.
- Unifying position/size (rather than keeping 3 different spots) was the
  user's explicit choice: since only one panel is ever visible, there's
  no reason for them to have 3 different rectangles — one consistent
  slot is simpler to reason about and directly answers "since at most
  one is ever visible, panels should be able to use more space than
  today," since a single panel now claims the whole slot instead of a
  fraction of it.

## Design

### 1. Shared CSS slot

**`style.css`:** new shared class:

```css
/* Shared right-side "slot": detail-card, regional-ai-panel, and
   markets-panel are now fully mutually exclusive (see
   closeOtherRightPanels() in js/01-core.js) - at most one is ever
   visible, so all three claim the same position/size instead of each
   having their own smaller rectangle. */
.right-panel-slot {
  top: 74px; right: 14px;
  width: 400px;
  max-height: calc(100vh - 130px);
}
```

`#detail-card`'s existing rule drops its own `top`/`right`/`width` (kept:
`overflow-y`, `padding`, `background`, `animation`, `max-height` is now
redundant with the shared class so it's removed too), replaced by adding
`class="right-panel-slot"` to the element in `index.html`. Same for
`#regional-ai-panel`. `#markets-panel` drops its current
`bottom: 14px; right: 14px; width: min(400px, calc(100vw - 28px));
max-height: 420px;` entirely, replaced the same way — it moves from
bottom-right back to the shared top-right slot.

The 3 elements' own CSS rules keep only what's genuinely
panel-specific (background/padding/animation/scrollbar for detail-card
and AI panel are already identical to each other; markets-panel keeps
its own `box-shadow`/`animation: slideUp` since its slide direction
differs from the other two's `slideIn`/`slideInRight`).

### 2. Close functions

**`js/05-detail.js`:** extract `wireDetailClose()`'s existing click-handler
body into a standalone function:

```js
function closeDetailPanel() {
  document.getElementById("detail-card").hidden = true;
  selectedName = null;
  map.getSource("selection").setData(emptyFC());
}

function wireDetailClose() {
  document.getElementById("detail-close").addEventListener("click", closeDetailPanel);
}
```

**`js/16-ai-features.js`:** same extraction for the AI panel's close
button, and this file's existing `showDetail` monkey-patch (which
currently does `aiPanel.hidden = true` inline) and
`updateRegionalAIPanel`'s existing inline detail-card-hiding block are
both replaced by calls to the shared coordinator (see section 3):

```js
function closeRegionalAIPanel() {
  const panel = document.getElementById("regional-ai-panel");
  if (panel) panel.hidden = true;
}

function wireRegionalAIClose() {
  const closeBtn = document.getElementById("regional-ai-close");
  if (closeBtn) closeBtn.addEventListener("click", closeRegionalAIPanel);
}
```

**`js/08-analytics.js`:** extract `wireMarketsToggle()`'s hide-branch into
a standalone function:

```js
function closeMarketsPanel() {
  const btn = document.getElementById("markets-btn");
  const panel = document.getElementById("markets-panel");
  if (!panel.hidden) {
    panel.hidden = true;
    btn.classList.remove("active");
    stopMarketsPolling();
  }
}
```

`wireMarketsToggle()`'s click handler calls `closeMarketsPanel()` in its
closing branch instead of inlining the same 3 lines, and calls
`closeOtherRightPanels("markets-panel")` right before opening (see
section 3).

### 3. Coordinator + rewired open sites

**`js/01-core.js`:** new function (added near the other small
cross-cutting helpers, e.g. next to `ResetViewControl`):

```js
function closeOtherRightPanels(exceptId) {
  const closers = {
    "detail-card": closeDetailPanel,
    "regional-ai-panel": closeRegionalAIPanel,
    "markets-panel": closeMarketsPanel
  };
  Object.entries(closers).forEach(([id, close]) => {
    if (id !== exceptId) {
      const el = document.getElementById(id);
      if (el && !el.hidden) close();
    }
  });
}
```

(Defined in `01-core.js` but *calling* `closeDetailPanel`/
`closeRegionalAIPanel`/`closeMarketsPanel`, which are defined later in
load order, in `05-detail.js`/`16-ai-features.js`/`08-analytics.js` — safe
because classic scripts share one global scope and this function isn't
*called* until user interaction happens well after all scripts have
loaded, only *defined* early. Same pattern the codebase already relies on
throughout, e.g. `applyFilters()` in `03-filters.js` calling
`renderSearchResults()` defined later in `04-search.js`.)

Three call sites change:
- `js/05-detail.js`'s `showDetail()`: add `closeOtherRightPanels("detail-card");`
  right before `card.hidden = false;`.
- `js/16-ai-features.js`'s `updateRegionalAIPanel()`: replace the existing
  inline "Mutual exclusion: Close the project detail card" block (which
  manually hides detail-card, clears `selectedName`, and clears the map
  selection source — exactly what `closeDetailPanel()` now does) with
  `closeOtherRightPanels("regional-ai-panel");` right before
  `panel.hidden = false;`. Also remove the `showDetail` monkey-patch's
  `aiPanel.hidden = true` line — no longer needed, `closeOtherRightPanels`
  called from `showDetail()` itself (previous bullet) now covers it.
- `js/08-analytics.js`'s `wireMarketsToggle()`: in the click handler's
  opening branch, add `closeOtherRightPanels("markets-panel");` before
  `if (!marketsChartLoaded) { ... }`.

## Non-goals

- No changes to what any panel renders/contains, or to facility/region/
  market data fetching.
- No changes to `#analytics-panel` (left side, independently toggled,
  never collides with the right-side trio — out of scope).
- No persistence of "which panel was last open" across reloads —
  consistent with how every panel in this app already resets on load.
- The Markets news feed (energy-industry news content) is a separate,
  already-deferred spec — not addressed here.
