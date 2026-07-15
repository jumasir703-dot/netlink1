const { query } = require('../db/pool');

async function findAll({ activeOnly = false } = {}) {
  const sql = activeOnly
    ? 'SELECT * FROM routers WHERE is_active = true ORDER BY name'
    : 'SELECT * FROM routers ORDER BY name';
  const { rows } = await query(sql);
  return rows;
}

async function findById(id) {
  const { rows } = await query('SELECT * FROM routers WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create(data) {
  const { name, host, apiPort = 8728, apiUser, apiPassword, useTls = false, siteLabel } = data;
  const { rows } = await query(
    `INSERT INTO routers (name, host, api_port, api_user, api_password, use_tls, site_label)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [name, host, apiPort, apiUser, apiPassword, useTls, siteLabel]
  );
  return rows[0];
}

async function update(id, data) {
  const fields = [];
  const values = [];
  let i = 1;
  for (const [key, val] of Object.entries(data)) {
    const column = key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
    fields.push(`${column} = $${i}`);
    values.push(val);
    i++;
  }
  values.push(id);
  const { rows } = await query(
    `UPDATE routers SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

module.exports = { findAll, findById, create, update };
