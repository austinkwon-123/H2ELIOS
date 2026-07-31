const express = require('express');
const pool = require('../db');
const { buildProjectFilter } = require('../lib/filters');

const router = express.Router();

// GET /api/analytics/summary?bbox=..&status=..&end_use=..
// Same filter semantics as /api/projects (shared buildProjectFilter), aggregated by
// technology for the split-view dashboard.
router.get('/summary', async (req, res) => {
  const { whereSql, params } = buildProjectFilter(req.query);

  // Storage rows are EXCLUDED from the megawatt sum on purpose.
  //
  // Storage capacity in the IEA source is an inventory quantity (tonnes of H2 /
  // stored energy), not a power rating, and the ETL's kt-H2/yr-to-MW
  // approximation converts it as if it were one. The result is not a small
  // error: 78 storage rows (2% of the table) carried 19,482,641 of the
  // 22,139,011 MW total - 88% of it - with a single salt cavern (Rehden)
  // claiming 10.7 GW, more than every announced electrolyser on Earth combined.
  // Summing power and inventory together is a unit error, so the fix is
  // categorical rather than a magic cutoff.
  //
  // project_count still counts every project; only the MW sum is scoped.
  const { rows } = await pool.query(
    `SELECT
       t.code AS technology,
       COUNT(*) AS project_count,
       COALESCE(SUM(p.current_capacity_mw)
                FILTER (WHERE p.category IS DISTINCT FROM 'storage'), 0) AS total_capacity_mw,
       COUNT(*) FILTER (WHERE p.category = 'storage') AS storage_project_count
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
      storage_project_count: acc.storage_project_count + Number(row.storage_project_count),
    }),
    { project_count: 0, total_capacity_mw: 0, storage_project_count: 0 }
  );

  // Named so a consumer cannot mistake it for "all capacity". Storage sites are
  // still counted and still on the map; they just have no meaningful MW figure.
  totals.capacity_basis = 'excludes storage (inventory units, not power)';

  res.json({ totals, by_technology: rows });
});

module.exports = router;
