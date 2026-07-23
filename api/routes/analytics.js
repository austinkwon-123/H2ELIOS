const express = require('express');
const pool = require('../db');
const { buildProjectFilter } = require('../lib/filters');

const router = express.Router();

// GET /api/analytics/summary?bbox=..&status=..&end_use=..
// Same filter semantics as /api/projects (shared buildProjectFilter), aggregated by
// technology for the split-view dashboard.
router.get('/summary', async (req, res) => {
  const { whereSql, params } = buildProjectFilter(req.query);

  const { rows } = await pool.query(
    `SELECT
       t.code AS technology,
       COUNT(*) AS project_count,
       COALESCE(SUM(p.current_capacity_mw), 0) AS total_capacity_mw
     FROM projects p
     LEFT JOIN technologies t ON t.id = p.technology_id
     ${whereSql}
     GROUP BY t.code
     ORDER BY total_capacity_mw DESC NULLS LAST`,
    params
  );

  const totals = rows.reduce(
    (acc, row) => ({
      project_count: acc.project_count + Number(row.project_count),
      total_capacity_mw: acc.total_capacity_mw + Number(row.total_capacity_mw),
    }),
    { project_count: 0, total_capacity_mw: 0 }
  );

  res.json({ totals, by_technology: rows });
});

module.exports = router;
