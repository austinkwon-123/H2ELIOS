# Timeline year drives the globe

Date: 2026-08-14
Status: approved, not yet implemented

## Problem

`#timeline-apply-map` is labelled "Apply year to map" and does not change the
map. It dispatches `TIMELINE_YEAR_UPDATE`, navigates to Explore, and calls
`applyTimelineFilter()` — which copies the year out of the store and calls
`applyFilters()`. `applyFilters()` filters by status, region and colour only.
No `setFilter` expression anywhere in the app contains a year term, so the
globe is pixel-identical before and after. The control promises a state change
it never performs.

The same gap makes the product's strongest idea unfilmable. Moving one input
and watching it propagate through custom WebGL geometry, vector filtering,
statistics and a chart is the clearest evidence the interface is a coordinated
system rather than a decorated map. Today that propagation stops at the
Timeline workspace boundary.

## What already exists

Two thirds of the mechanism is built:

- `preProcessDatasets()` (js/17-visualization.js) derives
  `properties.onlineYear` for every curated collection and for `IEA_DATA`,
  parsing the first `20\d{2}` out of each record's `updated`/`date` field and
  defaulting to 2020.
- `update3DTowers()` (js/17-visualization.js:646) **already** gates the 3D
  capacity spikes on `p.onlineYear > window.timelineYear`. The spikes respond
  to the year correctly today. Nobody can see it, because there is no way to
  change the year while looking at the globe.

The missing pieces are the flat vector layers, the trigger, and a control.

## Design

### 1. Make `onlineYear` reach the map's sources

`preProcessDatasets()` mutates the `D.*` GeoJSON objects, but `01-core.js`
adds the point layers before it runs, so MapLibre holds a copy of each feature
collection that predates the field. The derivation has no dependencies beyond
the datasets themselves, so it moves ahead of layer creation in the load
orchestrator rather than staying in the Timeline module.

Moving it, rather than calling `setData()` afterwards, avoids re-uploading
every source on boot and keeps a single ordering rule: derived properties are
materialised before anything reads them.

### 2. Add the year term to `currentFilter()`

In js/03-filters.js:43, alongside the existing status/region/colour parts:

```js
["any",
  ["!", ["has", "onlineYear"]],
  ["<=", ["get", "onlineYear"], window.timelineYear]]
```

The `!has` branch is load-bearing. Records without a known year must stay
visible, which is what `update3DTowers()` already does with
`if (p.onlineYear && p.onlineYear > window.timelineYear)`. Dropping that branch
would silently hide every undated project and quietly shrink the dataset.

Hubs keep their existing status+region-only filter. A hub is not a project with
a commissioning date, and gating it on a derived year would remove regions
wholesale.

### 3. Drive it from the store

One subscription to `state.timelineYear` that calls `applyFilters()` and, when
3D is active, `update3DTowers()`. This is what makes "Apply year to map" honest,
and it means any future surface that changes the year gets correct map
behaviour for free.

`applyTimelineFilter()` becomes redundant once the subscription exists and
should be removed along with its guarded call site in js/09-router.js:163.

### 4. Year scrubber on Explore

A slim year control in the map workspace so cause and effect are visible in one
frame: the scrubber moves, and the spikes, the flat markers and the counts all
respond together.

It writes through the store (`TIMELINE_YEAR_UPDATE`) and owns no state of its
own, so it and the Timeline workspace's slider stay in sync by construction.
It follows the existing map-control treatment and respects the collapsed
sidebar's geometry the way the comparison tray does.

## Non-goals

- No change to how `onlineYear` is derived. The parser's 2020 default and its
  `20\d{2}` heuristic are pre-existing modelling choices; changing them would
  move every figure in the app and belongs in its own piece of work.
- No year filtering for the live API tier. Its records carry no date field
  (`id, slug, name, statusClass, status, capacity, scale, technology, color,
  tier, capacity_mw`), so they fall into the `!has` branch and stay visible at
  every year. Making the API serve a commissioning date is separate work.
- No changes to the Timeline workspace's own rendering.

## Testing

- Set the year to 2020, count rendered features on the map, set it to 2035,
  assert the count strictly increases.
- Assert undated records are present at both ends of the range, so the `!has`
  branch cannot regress into hiding them.
- Assert `#timeline-apply-map` produces a different rendered-feature count than
  the same map at a different year — the specific bug that motivated this.
- Assert the Explore scrubber and the Timeline slider report the same year
  after either one moves.

## Risks

- Feature counts on the map depend on tile loading, so tests must wait on a
  settled map rather than a fixed timeout. Sampling early reports an
  incompletely populated style; this has already produced two wrong
  conclusions during investigation.
- `preProcessDatasets()` moving earlier changes boot ordering. The load
  orchestrator in 01-core.js is the one place that must be re-verified.
