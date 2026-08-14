# True 3D capacity spikes on the globe

Date: 2026-07-31
Status: approved (option A)

## Problem

Neither of the app's two 3D-bar systems renders on the globe.

MapLibre 5.24.0 draws `fill-extrusion` footprints under globe projection but
**ignores `fill-extrusion-height`** — polygons drape flat to the sphere. Verified
with an isolated probe: identical code and version, globe renders a flat hexagon,
mercator + pitch renders a real extruded bar.

Two layers are affected:

| Layer | File | Status |
|---|---|---|
| `3d-towers` (dock toggle "Toggle 3D Volumetric Extrusions") | `js/17-visualization.js:466` | Builds features correctly (1699 confirmed in source) — globe won't extrude them |
| `api-projects-extrusion` ("Spikey Earth") | `js/18-api-live.js:409` | Same projection problem, **plus** zero data without the Postgres backend |

`js/18-api-live.js:166-181` tunes spike heights to ~251 km "to look right at globe
zoom." That tuning rests on an assumption that does not hold.

The `api-projects-extrusion` dependency on `/api` also means the feature is dead on
any static host — which is where the public demo will live.

## Approach

Replace the `fill-extrusion` approach with a custom WebGL layer. It lifts
vertices off the sphere in the vertex shader via
`projectTileFor3D(vec2 posInTile, float elevationMeters)`,
injected per-frame through `shaderDescription.vertexShaderPrelude` — the supported
MapLibre v5 mechanism that stays correct under **both** projections and
interpolates across the globe→mercator transition near z12.

## Design

### New module — `js/20-spikes.js`

A `CustomLayerInterface` layer, `id: "h2grid-3d-spikes"`, `renderingMode: "3d"`,
loaded after the app modules it consumes. Classic script sharing global scope,
per the repo's existing convention (see README "Editing rules").

### Data source

Driven by data that **ships in the repo**, so the spikes work on a static host:

- `D.production.features` + `D.storagePoints.features` (84 curated nodes), and
- `window.IEA_DATA` entries with `category` of `production` or `storage`, only
  while the IEA layer is visible

This is the same selection `update3DTowers()` already performs
(`js/17-visualization.js:478-485`), and it respects the same four filters
(`statusFilter`, `regionFilter`, `colorFilter`, `window.timelineYear`).

Deliberately **not** fed by `/api`. The hero visual must not depend on a backend.
API rows remain a later optional enhancement, not a prerequisite.

### Geometry

One square prism per project, as a single `TRIANGLE_STRIP` of 10 vertices: four
corners in mercator space at `halfWidth` around the point, emitted as
base/top pairs and wrapping back to the first corner.

Per-vertex interleaved layout, 8 floats (`VERTEX_STRIDE = 32` bytes), baking
per-instance constants onto every vertex so one uniform state can draw the whole
buffer:

```
[ mercX, mercY, top, corner, r, g, b, height ]
```

- `top` — 0 at the base, 1 at the apex; multiplies elevation in the shader
- `corner` — 0..3, drives per-face shading so adjacent faces read as distinct
- `height` — the spike's apex elevation in meters, baked per project

All spikes live in **one** VBO, rebuilt on filter change. At the maximum of ~3,422
projects that is ~34,220 vertices — negligible for the GPU, and a single
`drawArrays` per frame.

### Height scaling

`height = clamp(capacityMw ^ 0.45 * FACTOR, MIN, MAX)`, reusing the exponent and
clamp rationale already documented at `js/18-api-live.js:172-181` (the dataset
contains a ~10.7M "MW" ETL artifact that must be clamped, or one row produces a
spike nine times Earth's radius).

Because a height that reads well on the globe is absurd at street zoom, `render()`
passes a `u_heightScale` uniform derived from `map.getZoom()`, and the vertex
shader multiplies by it. This keeps spikes legible across the whole zoom range
rather than tuning for one camera distance — the specific failure of the existing
"Spikey Earth" constants.

### Appearance

Additive blending so spikes read as emissive light rather than solid plastic.
Vertical gradient in the fragment shader: bright at the base,
fading toward the apex. Per-face brightness from `corner` for form definition.
Color from the existing hydrogen-taxonomy map (`COLOR_HEX_MAP` / `COLORS`), so
spikes carry the same data encoding as every other layer.

### Wiring

Reuses the existing dock toggle `#dock-3d-btn` ("Toggle 3D Volumetric
Extrusions"). A custom-type layer has no `setLayoutProperty` visibility switch, so
visibility is a plain flag on the layer object toggled directly.

On toggle:
- **on** — build buffer, ease pitch to ~48°, set `visible = true`
- **off** — `visible = false`, ease pitch back to 0

The existing `3d-towers` `fill-extrusion` layer and `update3DTowers()` are
**removed** — they cannot work on the globe and would double-draw in mercator.

Rebuilds on the same events that drive `applyFilters`, so spikes track filter and
timeline changes.

### Unpinned MapLibre

`index.html:206` loads `maplibre-gl@5`, a floating major range currently resolving
to 5.24.0. A published site must not change renderer behavior on its own, and the
shader plumbing here is version-sensitive. Pin to the exact version verified
against.

## Verification

Real-browser checks, per this project's established practice:

1. Globe projection, 3D on → `queryRenderedFeatures` is not the measure (custom
   layers are not queryable); verify by **screenshot** that spikes stand off the
   sphere.
2. Mercator at high zoom → spikes still upright and correctly scaled.
3. Toggle off → no spikes drawn, pitch returns to 0.
4. Change status/region/color filter → spike count changes accordingly.
5. Console clean, in particular no shader compile or program link errors.
6. Frame rate stays interactive with the IEA layer on (~3.4k spikes).

## Out of scope

- Feeding API rows into the spike layer
- Click/hover picking on spikes (the existing circle layers remain the hit target,
  same division of labor as `js/18-api-live.js:405-408`)
- Removing `api-projects-extrusion` — it stays for the backend-enabled local mode;
  it is simply not the public demo's hero visual
