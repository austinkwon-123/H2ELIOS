// etl/import-iea-data.js
//
// One-time / re-runnable ETL: js/iea-data.js (window.IEA_DATA GeoJSON, ~3.3k features)
//   -> projects, project_state_history, project_metric_history, technologies
//
// Strategy
// --------
// EXTRACT   iea-data.js is a browser script, not JSON (`window.IEA_DATA = {...};`).
//           We isolate the object literal by regex rather than eval()'ing the file,
//           since it's untrusted-ish generated content and eval is unnecessary risk.
//
// TRANSFORM Per feature:
//   - technology: upsert the free-text `subtype` into `technologies` (dictionary grows
//     with the data instead of forcing everything into ALK/PEM/SOEC).
//   - state: `statusClass` from the source is coarser than our enum (it merges FID and
//     Construction). Re-derive planned/fid/construction/live/at_risk/cancelled from the
//     raw `status` string so the timeline slider has the finer-grained state we modeled.
//   - capacity: parse the free-text capacity string ("1GW", "23.5 MWel", "40 kt H2/y")
//     into a normalized MW figure. kt H2/y has no exact MW equivalent (depends on
//     capacity factor); we use the same kt*60 approximation build-iea.js already uses
//     for its own marker-scale calculation, and mark that row's provenance accordingly
//     so nobody mistakes it for a nameplate MW figure later.
//   - effective_at: source only gives a bare year (or nothing). We record what we know:
//     Jan 1 of that year at 'year_only' confidence, or the ETL run time at
//     'fallback_ingest' confidence. This is what date_confidence (migration 002) is for.
//   - slug: name is not unique in the source (multi-phase projects share a name). Slug is
//     `slugify(name)-{iso3}`, de-duplicated with a numeric suffix on collision.
//
// LOAD      Bulk insert via UNNEST (fast for ~3.3k rows, and the pattern scales to the
//           AI pipeline's larger future volumes without switching approach). Per the
//           agreed sync mechanism, projects + their initial state/metric history are
//           written in one application-level transaction — no DB triggers.
//
// Usage:
//   DATABASE_URL=postgres://... node etl/import-iea-data.js [--reset]
//
//   --reset  Truncates projects/technologies/project_state_history/project_metric_history
//            first. Without it, re-running upserts projects by slug and technologies by
//            code, but does NOT append duplicate history rows for an unchanged source file.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const { randomUUID } = crypto;

const SOURCE_FILE = path.join(__dirname, '..', 'js', 'iea-data.js');
const CHUNK_SIZE = 1000;
const RESET = process.argv.includes('--reset');

// ---------- EXTRACT ----------

function extractIeaData(source) {
  const text = fs.readFileSync(source, 'utf8');

  const dataMatch = text.match(/window\.IEA_DATA\s*=\s*(\{[\s\S]*\})\s*;\s*$/m);
  if (!dataMatch) {
    throw new Error(`Could not locate window.IEA_DATA object literal in ${source}`);
  }
  const metaMatch = text.match(/window\.IEA_META\s*=\s*(\{[\s\S]*?\})\s*;/);

  return {
    meta: metaMatch ? JSON.parse(metaMatch[1]) : null,
    data: JSON.parse(dataMatch[1]),
  };
}

// ---------- TRANSFORM ----------

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function mapState(rawStatus, statusClass) {
  const s = String(rawStatus || '').toLowerCase();
  if (statusClass === 'atrisk') return s.includes('cancel') ? 'cancelled' : 'at_risk';
  if (statusClass === 'construction') {
    return s.includes('fid') && !s.includes('construction') ? 'fid' : 'construction';
  }
  if (statusClass === 'operating') return 'live';
  return 'planned';
}

// Returns { mw: number|null, approxFromKt: boolean }
function parseCapacityMw(capStr) {
  const s = String(capStr || '').trim();
  if (!s || s.toLowerCase() === 'n/a') return { mw: null, approxFromKt: false };

  let m = s.match(/([\d.]+)\s*GW/i);
  if (m) return { mw: parseFloat(m[1]) * 1000, approxFromKt: false };

  m = s.match(/([\d.]+)\s*MW/i);
  if (m) return { mw: parseFloat(m[1]), approxFromKt: false };

  m = s.match(/([\d.]+)\s*kt\s*H2\s*\/?\s*y/i);
  if (m) return { mw: parseFloat(m[1]) * 60, approxFromKt: true }; // matches build-iea.js's own kt->MW heuristic

  return { mw: null, approxFromKt: false };
}

function effectiveAtFromYear(yearStr, ingestTimestamp) {
  const y = String(yearStr || '').trim();
  if (/^\d{4}$/.test(y)) {
    return { effectiveAt: new Date(Date.UTC(parseInt(y, 10), 0, 1)), confidence: 'year_only' };
  }
  return { effectiveAt: ingestTimestamp, confidence: 'fallback_ingest' };
}

function normalizeColorClass(color) {
  const allowed = new Set(['green', 'blue', 'pink', 'turquoise', 'gray', 'gray_blue', 'brown', 'mfg']);
  return allowed.has(color) ? color : 'gray';
}

// Source rows carry end_refining, end_ammonia, ... as 0/1. Strip the prefix and keep only
// the ones actually present/true — JSONB stores {"ammonia": 1, "mobility": 1}, not a fixed
// set of 12 always-present false keys, so the schema is free to grow new end-use categories
// later without a migration, and a future MW-per-end-use value can replace the 1 in place.
const END_USE_PREFIX = 'end_';
function extractEndUses(props) {
  const endUses = {};
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith(END_USE_PREFIX) && value) {
      endUses[key.slice(END_USE_PREFIX.length)] = value;
    }
  }
  return endUses;
}

function extractSources(refsField) {
  if (!refsField) return [];
  return String(refsField)
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Builds a Postgres array-literal string, e.g. sources ["a","b"] -> '{"a","b"}'.
// Used so variable-length per-row arrays can travel through UNNEST as a plain text[]
// parameter (one literal-string per row) and get cast to text[] again inside the query,
// instead of needing a rectangular text[][] which UNNEST can't jag per row.
function toPgArrayLiteral(arr) {
  if (!arr || arr.length === 0) return '{}';
  const esc = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  return `{${arr.map(esc).join(',')}}`;
}

function transform(featureCollection, ingestTimestamp) {
  const technologies = new Map(); // code -> { code, label, color_class }
  const projects = [];
  const stateHistory = [];
  const metricHistory = [];
  const slugCounts = new Map();

  for (const feature of featureCollection.features || []) {
    const p = feature.properties || {};
    const [lng, lat] = feature.geometry.coordinates;

    const techCode = slugify(p.subtype || 'unknown') || 'unknown';
    if (!technologies.has(techCode)) {
      technologies.set(techCode, {
        code: techCode,
        label: p.subtype || 'Unknown',
        color_class: normalizeColorClass(p.color),
      });
    }

    let baseSlug = `${slugify(p.name || 'unnamed')}-${(p.country || 'xxx').toLowerCase()}`;
    const n = slugCounts.get(baseSlug) || 0;
    slugCounts.set(baseSlug, n + 1);
    const slug = n === 0 ? baseSlug : `${baseSlug}-${n + 1}`;

    const id = randomUUID();
    const state = mapState(p.status, p.statusClass);
    const { mw: capacityMw, approxFromKt } = parseCapacityMw(p.capacity);
    const { effectiveAt, confidence } = effectiveAtFromYear(p.updated, ingestTimestamp);

    projects.push({
      id,
      name: p.name || 'Unnamed project',
      slug,
      country_code: (p.country || '').slice(0, 3).toUpperCase() || null,
      region: p.region || null,
      category: p.category || null,
      lng,
      lat,
      technology_code: techCode,
      current_state: state,
      current_capacity_mw: capacityMw,
      current_capex_usd: null, // not present in the IEA source; left for future enrichment
      data_source: 'iea',
      confidence: p.approx ? 0.6 : 1.0,
      end_uses: extractEndUses(p),
      sources: extractSources(p.refs),
    });

    stateHistory.push({
      project_id: id,
      state,
      effective_at: effectiveAt,
      date_confidence: confidence,
      source: `iea:${SOURCE_FILE}`,
    });

    if (capacityMw !== null) {
      metricHistory.push({
        project_id: id,
        metric: 'capacity_mw',
        value: capacityMw,
        effective_at: effectiveAt,
        source: approxFromKt ? 'iea:approx-kt-to-mw' : 'iea',
      });
    }
  }

  return { technologies: [...technologies.values()], projects, stateHistory, metricHistory };
}

// ---------- LOAD ----------

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function loadTechnologies(client, technologies) {
  const codeToId = new Map();
  for (const batch of chunk(technologies, CHUNK_SIZE)) {
    const { rows } = await client.query(
      `INSERT INTO technologies (code, label, color_class)
       SELECT * FROM UNNEST($1::text[], $2::text[], $3::text[])
       ON CONFLICT (code) DO UPDATE SET label = EXCLUDED.label
       RETURNING id, code`,
      [batch.map((t) => t.code), batch.map((t) => t.label), batch.map((t) => t.color_class)]
    );
    for (const row of rows) codeToId.set(row.code, row.id);
  }
  return codeToId;
}

async function loadProjects(client, projects, techCodeToId) {
  for (const batch of chunk(projects, CHUNK_SIZE)) {
    await client.query(
      `INSERT INTO projects (
         id, name, slug, country_code, region, category, location,
         technology_id, current_state, current_capacity_mw, current_capex_usd,
         data_source, confidence, end_uses, sources
       )
       SELECT
         id, name, slug, country_code, region, category,
         ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
         technology_id, current_state, current_capacity_mw, current_capex_usd,
         data_source, confidence, end_uses, sources_literal::text[]
       FROM UNNEST(
         $1::uuid[], $2::text[], $3::text[], $4::char(3)[], $5::text[], $6::text[],
         $7::double precision[], $8::double precision[], $9::smallint[], $10::text[],
         $11::numeric[], $12::numeric[], $13::text[], $14::numeric[], $15::jsonb[], $16::text[]
       ) AS t(
         id, name, slug, country_code, region, category,
         lng, lat, technology_id, current_state, current_capacity_mw, current_capex_usd,
         data_source, confidence, end_uses, sources_literal
       )
       ON CONFLICT (slug) DO UPDATE SET
         current_state = EXCLUDED.current_state,
         current_capacity_mw = EXCLUDED.current_capacity_mw,
         end_uses = EXCLUDED.end_uses,
         sources = EXCLUDED.sources,
         updated_at = now()`,
      [
        batch.map((p) => p.id),
        batch.map((p) => p.name),
        batch.map((p) => p.slug),
        batch.map((p) => p.country_code),
        batch.map((p) => p.region),
        batch.map((p) => p.category),
        batch.map((p) => p.lng),
        batch.map((p) => p.lat),
        batch.map((p) => techCodeToId.get(p.technology_code)),
        batch.map((p) => p.current_state),
        batch.map((p) => p.current_capacity_mw),
        batch.map((p) => p.current_capex_usd),
        batch.map((p) => p.data_source),
        batch.map((p) => p.confidence),
        batch.map((p) => JSON.stringify(p.end_uses)),
        // Each element is itself a Postgres array-literal string (see toPgArrayLiteral);
        // sources_literal::text[] below re-parses it per row.
        batch.map((p) => toPgArrayLiteral(p.sources)),
      ]
    );
  }
}

async function loadStateHistory(client, rows) {
  for (const batch of chunk(rows, CHUNK_SIZE)) {
    await client.query(
      `INSERT INTO project_state_history (project_id, state, effective_at, date_confidence, source)
       SELECT * FROM UNNEST($1::uuid[], $2::text[], $3::timestamptz[], $4::text[], $5::text[])`,
      [
        batch.map((r) => r.project_id),
        batch.map((r) => r.state),
        batch.map((r) => r.effective_at),
        batch.map((r) => r.date_confidence),
        batch.map((r) => r.source),
      ]
    );
  }
}

async function loadMetricHistory(client, rows) {
  for (const batch of chunk(rows, CHUNK_SIZE)) {
    await client.query(
      `INSERT INTO project_metric_history (project_id, metric, value, effective_at, source)
       SELECT * FROM UNNEST($1::uuid[], $2::text[], $3::numeric[], $4::timestamptz[], $5::text[])`,
      [
        batch.map((r) => r.project_id),
        batch.map((r) => r.metric),
        batch.map((r) => r.value),
        batch.map((r) => r.effective_at),
        batch.map((r) => r.source),
      ]
    );
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('Set DATABASE_URL, e.g. postgres://user:pass@localhost:5432/h2grid');
  }

  console.log(`Extracting from ${SOURCE_FILE}...`);
  const { meta, data } = extractIeaData(SOURCE_FILE);
  console.log(`Source meta: ${meta ? JSON.stringify(meta) : 'none'}`);
  console.log(`Parsed ${data.features.length} features.`);

  const ingestTimestamp = new Date();
  const { technologies, projects, stateHistory, metricHistory } = transform(data, ingestTimestamp);
  console.log(
    `Transformed: ${technologies.length} technologies, ${projects.length} projects, ` +
      `${stateHistory.length} state rows, ${metricHistory.length} metric rows.`
  );

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (RESET) {
      console.log('--reset: truncating project_metric_history, project_state_history, projects, technologies...');
      await client.query(
        'TRUNCATE project_metric_history, project_state_history, projects, technologies RESTART IDENTITY CASCADE'
      );
    }

    const techCodeToId = await loadTechnologies(client, technologies);
    await loadProjects(client, projects, techCodeToId);
    await loadStateHistory(client, stateHistory);
    await loadMetricHistory(client, metricHistory);

    await client.query('COMMIT');
    console.log('Committed.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
