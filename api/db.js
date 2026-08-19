const { Pool } = require('pg');

// A fresh clone should still serve the complete static observatory when
// Postgres is not installed. Keep the failure at the API boundary instead of
// crashing server.js during require(): the frontend already treats a 503 as an
// honest cached/static-data state, while /api/quotes can continue to work
// independently when only FINNHUB_KEY is configured.
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : {
      async query() {
        const error = new Error('Live project analytics require DATABASE_URL');
        error.status = 503;
        throw error;
      }
    };

module.exports = pool;
