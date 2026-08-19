<div align="center">
  <img src="assets/h2elios-lockup.svg" alt="H2ELIOS" width="360" />

  <p><strong>A 3D spatial observatory for the global hydrogen industry.</strong></p>

  [![CI](https://github.com/austinkwon-123/H2ELIOS/actions/workflows/ci.yml/badge.svg)](https://github.com/austinkwon-123/H2ELIOS/actions/workflows/ci.yml)
  ![Vanilla JavaScript](https://img.shields.io/badge/frontend-vanilla%20JavaScript-f7df1e?logo=javascript&logoColor=111)
  ![MapLibre GL](https://img.shields.io/badge/globe-MapLibre%20GL-396cb2)
  ![PostgreSQL](https://img.shields.io/badge/data-PostgreSQL%20%2B%20PostGIS-4169e1?logo=postgresql&logoColor=fff)
</div>

H2ELIOS combines an interactive MapLibre globe, custom WebGL rendering, and
linked analytical workspaces to explore hydrogen projects, infrastructure,
economics, technology, demand, policy, and project timelines.

The frontend deliberately has no framework, bundler, or build step. Its custom
capacity spikes and 3D pipeline ribbons are rendered through hand-written GLSL
layers, while an optional Express/Postgres backend supplies viewport-scoped
analytics for 3,338 announced projects.

## Highlights

- MapLibre GL v5 globe with dark and light themes.
- Custom WebGL capacity spikes and globe-aware 3D pipeline ribbons.
- 3,338 announced-project records plus curated and European infrastructure
  layers with source attribution and precision flags.
- Seven linked workspaces: Explore, Economics, Technology, Demand, Policy,
  Timeline, and Calculator.
- Project comparison, responsive inspectors, map-to-workspace handoffs, and
  accessible keyboard navigation.
- Live viewport analytics through Express, PostgreSQL, PostGIS, and TimescaleDB.
- Live market video, comparison chart, and hydrogen equity watchlist with an
  automatic TradingView fallback.
- Playwright browser coverage and Node unit/data-contract tests.

## Run it on any computer

Requirements: [Git](https://git-scm.com/), Node.js 22+, and an internet
connection for the map tiles and third-party live surfaces.

```bash
git clone https://github.com/austinkwon-123/H2ELIOS.git
cd H2ELIOS
npm ci
npm start
```

Open <http://127.0.0.1:8000>.

That is enough for the complete static-data experience. Postgres and API keys
are optional: when they are absent, H2ELIOS starts normally and labels the live
surfaces that are unavailable instead of crashing.

## Optional live backend

Copy the environment template, start the bundled database, apply migrations,
and import the IEA snapshot:

```bash
cp .env.example .env
docker compose up -d db
npm run db:migrate
npm run db:seed
npm start
```

On PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

Optional keys:

- `FINNHUB_KEY` in `.env` enables server-proxied equity quotes.
- `NREL_API_KEY` in `js/config.js` enables the DOE AFDC station feed. Copy
  `js/config.example.js` first; browser configuration is public by design.

Never commit `.env` or `js/config.js`.

## Tests

```bash
npm run test:unit      # store, import, and server/data contracts
npm run test:ui        # Playwright interaction and responsive-layout tests
npm test               # both suites
```

The live viewport test skips itself when Postgres is unavailable. That skip is
intentional; all static and interface behavior remains testable without a
database.

## Architecture

| Area | Files | Responsibility |
| --- | --- | --- |
| Shell and globe | `index.html`, `style.css`, `js/01-core.js`–`js/07-live.js` | Layout, MapLibre lifecycle, layers, filtering, search, project detail, live stations |
| Analysis | `js/08-analytics.js`–`js/17-visualization.js` | Markets and the linked economics, technology, demand, policy, timeline, and calculator workspaces |
| Custom 3D | `js/19-command-arcs.js`, `js/19-pipeline-ribbons.js`, `js/20-spikes.js` | GLSL corridors, pipeline ribbons, and capacity geometry |
| Spatial shell | `js/23-spatial-shell.js`, `js/24-geology-intelligence.js` | Responsive navigation, focus mode, panel ownership, and geology context |
| Backend | `server.js`, `api/`, `db/migrations/`, `etl/` | Static hosting, JSON APIs, spatial schema, and dataset import |
| Verification | `tests/`, `playwright.config.js`, `.github/workflows/ci.yml` | Unit, data-contract, browser, accessibility, and CI coverage |

Scripts in `js/` are classic scripts sharing one global scope. Their order in
`index.html` is dependency order; converting a single file to an ES module will
break that contract.

## Data and attribution

The application combines IEA project data, DOE/NREL station data, IPCEI Clean
Hydrogen Observatory datasets, H2InfraMap ArcGIS layers, GEM references,
OpenStreetMap/CARTO basemaps, and cited company or project sources. Each source
retains its own terms. Approximate records are marked as approximate in the
generated data rather than presented as surveyed locations.

The H2InfraMap ArcGIS items used by the snapshot publish no license or
terms-of-use text. The generated metadata records that absence explicitly; do
not interpret repository visibility as a new license grant for source data.

## Contributing and deployment

See [CONTRIBUTING.md](CONTRIBUTING.md) for architecture constraints and pull
request expectations. See [DEPLOY.md](DEPLOY.md) for static and full-stack
deployment options.

No project-wide software license is currently granted. Source code and bundled
datasets therefore remain subject to their existing rights and source terms.
