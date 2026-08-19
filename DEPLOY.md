# Deploying H2ELIOS

H2ELIOS can run in two modes. Choose based on whether the deployment needs the
Postgres-backed viewport API.

## Static mode

Static hosting serves `index.html`, the CSS files, `assets/`, and `js/` exactly
as committed. There is no frontend build command or generated bundle.

Static mode includes the globe, bundled datasets, all seven workspaces,
comparison, 3D layers, the calculator, and third-party market surfaces. The
Live viewport panel reports unavailable API data because `/api/*` is absent.

Suitable hosts include GitHub Pages, Cloudflare Pages, Netlify, and any plain
HTTP server. Configure the publish directory as the repository root and leave
the build command empty.

## Full-stack mode

Use a Node-capable host when Live viewport analytics or server-proxied Finnhub
quotes are required.

### Runtime

- Node.js 22+
- `npm ci`
- Start command: `npm start`
- Environment: `HOST=0.0.0.0`, provider-assigned `PORT`

The app starts without Postgres and serves its static baseline. Database-backed
API routes return HTTP 503 until `DATABASE_URL` is configured.

### Database

The included `docker-compose.yml` provides PostgreSQL 16 with PostGIS and
TimescaleDB for local or self-hosted environments:

```bash
cp .env.example .env
docker compose up -d db
npm run db:migrate
npm run db:seed
```

For a managed database, set `DATABASE_URL` to a PostgreSQL instance that
supports PostGIS and TimescaleDB, then run the same migration and seed commands
from a trusted deployment shell.

### Secrets

- `DATABASE_URL`: server-only Postgres connection string.
- `FINNHUB_KEY`: optional server-only market quote key.
- `NREL_API_KEY`: currently a browser-side free-tier key configured through
  `js/config.js`; anything stored there is visible to visitors.

Do not commit `.env`, `js/config.js`, database volumes, test reports, or browser
traces. They are covered by `.gitignore`.

## Verification

Run before deployment:

```bash
npm ci
npm run test:unit
npx playwright install chromium
npm run test:ui
```

CI repeats these checks for pushes to `main` and for pull requests. A live API
test skips when Postgres is intentionally absent; it runs when a reachable
database is supplied.

## Editing from another device

```bash
git clone https://github.com/austinkwon-123/H2ELIOS.git
cd H2ELIOS
npm ci
git switch -c your-name/change-description
```

After editing, commit and push the branch, then open a pull request into
`main`. Never copy `.env` between devices through GitHub; configure secrets
locally on each machine.
