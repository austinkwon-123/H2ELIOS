# H₂Grid OS — Preview & Deploy (v8 · Observatory)

Static site, no build step. Runtime files: `index.html`, `style.css`, `hud.css`,
`app.js`, `iea-layer.js`, `hud.js`, `data.js`, `iea-data.js`.
Dev-only: `smoke-test.js`, `build-iea.py`.

## Preview
```
cd hydrogen-map-v8
python -m http.server 8000   # open http://localhost:8000
```
Internet required: MapLibre GL v5, CARTO tiles, Google Fonts, AFDC live fetch.

## What's new in v6
- **IEA announced tier (📡)**: all 3,338 records from the IEA Hydrogen Production
  & Infrastructure Projects Databases (June 2026, CC BY 4.0) as a clustered
  holographic layer — 2,402 at real reported coordinates, 936 flagged
  country-approximate. Click clusters to expand, click points for details.
  Status/region/color filters rebuild the clusters live.
- **Three-tier counters**: 138 verified (hand-curated, cited), 678 mapped European
  assets (H2InfraMap ArcGIS snapshot, locations approximate and indicative) and
  3,338 announced (IEA). The sidebar footer computes its figures from the loaded
  data rather than carrying them as copy, so they cannot drift after an import.
- **JARVIS HUD**: boot sequence on load, rotating targeting reticle locks onto
  selected facilities, decode-text effect on the detail sheet, HUD corner
  brackets, scanline + vignette overlay (dark mode).
- **Refresh pipeline**: rerun `python3 build-iea.py` whenever IEA updates the
  databases (point paths at the new XLSX files) — regenerates `iea-data.js`.

## Before public launch
1. Swap `DEMO_KEY` in `app.js` for a free personal NREL key.
2. `iea-data.js` is ~1.2 MB — enable gzip/brotli on your host (Netlify/Vercel do
   this automatically; it compresses to ~180 KB).
3. Keep the IEA CC BY 4.0 attribution visible (already in the footer + ticker link).
4. Get a free Finnhub API key (https://finnhub.io/register) and set `FINNHUB_KEY`
   in `js/08-analytics.js` to enable live quotes in the analytics panel's Markets
   section — it ships empty and shows a "configure API key" fallback until you do.

## v7 visual system
Single dark mission-control theme (light mode retired). All styling flows from
CSS tokens in `:root` (`style.css`): surfaces `--bg-0/--panel`, hairlines
`--line*`, text scale `--text-hi/--text/--text-muted/--text-faint`, accents
`--cyan/--amber/--red`, radii `--r-sm/md/lg`. Hydrogen taxonomy colors are
preserved untouched as data encoding (`--h-*`). Dock icons are monochrome
outline SVGs; glow is layered (sharp core + faint halo) and reserved for
active/selected elements.
