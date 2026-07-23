const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  throw new Error('Set DATABASE_URL, e.g. postgres://user:pass@localhost:5432/h2grid');
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = pool;
