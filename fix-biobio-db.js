require('dotenv').config({ path: 'C:/Users/user/OneDrive - 라이트브릿지/바탕 화면/WORKFORCE/H2Grid/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const before = await pool.query(
    `SELECT id, slug, ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat
     FROM projects WHERE slug = 'synfuels-biobio-chl'`
  );
  console.log("before:", before.rows);

  const row = before.rows[0];
  if (!row) { console.log("no matching row found"); await pool.end(); return; }

  // Swap back: source data had [lng, lat] reversed for this one row (see
  // build-iea.js's LATLNG_SWAP_FIX comment for the confirmed real-world check).
  await pool.query(
    `UPDATE projects SET location = ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography WHERE id = $3`,
    [row.lat, row.lng, row.id]
  );

  const after = await pool.query(
    `SELECT id, slug, ST_X(location::geometry) AS lng, ST_Y(location::geometry) AS lat
     FROM projects WHERE slug = 'synfuels-biobio-chl'`
  );
  console.log("after:", after.rows);
  await pool.end();
})().catch((err) => { console.error(err); process.exit(1); });
