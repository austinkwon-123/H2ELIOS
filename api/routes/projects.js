const express = require('express');
const pool = require('../db');
const { buildProjectFilter } = require('../lib/filters');

const router = express.Router();

// GET /api/projects?bbox=..&status=..&end_use=..
// Lightweight flat JSON for the 3D globe - no GeoJSON wrapper, coordinates extracted
// server-side so the client never touches WKB.
router.get('/', async (req, res) => {
  const { whereSql, params } = buildProjectFilter(req.query);

  const { rows } = await pool.query(
    `SELECT
       p.id,
       p.slug,
       ST_X(p.location::geometry) AS lng,
       ST_Y(p.location::geometry) AS lat,
       p.current_state AS status,
       p.current_capacity_mw AS capacity_mw,
       t.code AS technology,
       p.end_uses
     FROM projects p
     LEFT JOIN technologies t ON t.id = p.technology_id
     ${whereSql}`,
    params
  );

  res.json(rows);
});

// GET /api/projects/:slug
// Full detail for the sidebar: base project + its state/metric history, newest first.
router.get('/:slug', async (req, res) => {
  const { rows: projectRows } = await pool.query(
    `SELECT
       p.id,
       p.name,
       p.slug,
       p.country_code,
       p.region,
       p.category,
       ST_X(p.location::geometry) AS lng,
       ST_Y(p.location::geometry) AS lat,
       p.current_state AS status,
       p.current_capacity_mw AS capacity_mw,
       p.current_capex_usd AS capex_usd,
       p.data_source,
       p.confidence,
       p.end_uses,
       p.sources,
       t.code AS technology,
       t.label AS technology_label,
       t.color_class AS technology_color_class,
       p.created_at,
       p.updated_at
     FROM projects p
     LEFT JOIN technologies t ON t.id = p.technology_id
     WHERE p.slug = $1`,
    [req.params.slug]
  );

  const project = projectRows[0];
  if (!project) {
    return res.status(404).json({ error: `No project with slug "${req.params.slug}"` });
  }

  const [{ rows: stateHistory }, { rows: metricHistory }] = await Promise.all([
    pool.query(
      `SELECT state, effective_at, date_confidence, source
       FROM project_state_history
       WHERE project_id = $1
       ORDER BY effective_at DESC`,
      [project.id]
    ),
    pool.query(
      `SELECT metric, value, effective_at, source
       FROM project_metric_history
       WHERE project_id = $1
       ORDER BY effective_at DESC`,
      [project.id]
    ),
  ]);

  res.json({ ...project, state_history: stateHistory, metric_history: metricHistory });
});

module.exports = router;
