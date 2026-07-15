const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[pg pool] unexpected error on idle client', err);
});

/**
 * Run a query with automatic client release.
 */
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development') {
    console.log('[db]', { text, duration, rows: res.rowCount });
  }
  return res;
}

/**
 * Get a client for manual transaction control.
 * Usage:
 *   const client = await getClient();
 *   try { await client.query('BEGIN'); ... await client.query('COMMIT'); }
 *   finally { client.release(); }
 */
async function getClient() {
  const client = await pool.connect();
  return client;
}

module.exports = { pool, query, getClient };
