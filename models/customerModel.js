const { query } = require('../db/pool');

async function findAll({ status, connectionType, limit = 100, offset = 0 } = {}) {
  const conditions = [];
  const values = [];
  let i = 1;

  if (status) { conditions.push(`status = $${i++}`); values.push(status); }
  if (connectionType) { conditions.push(`connection_type = $${i++}`); values.push(connectionType); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit, offset);

  const { rows } = await query(
    `SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i}`,
    values
  );
  return rows;
}

async function findById(id) {
  const { rows } = await query('SELECT * FROM customers WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findByPhone(phone) {
  const { rows } = await query('SELECT * FROM customers WHERE phone = $1', [phone]);
  return rows[0] || null;
}

async function create({ fullName, phone, email, address, connectionType = 'hotspot', routerId }) {
  const { rows } = await query(
    `INSERT INTO customers (full_name, phone, email, address, connection_type, router_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [fullName, phone, email, address, connectionType, routerId]
  );
  return rows[0];
}

async function findOrCreateByPhone({ phone, fullName, connectionType = 'hotspot' }) {
  const existing = await findByPhone(phone);
  if (existing) return existing;
  return create({ fullName: fullName || phone, phone, connectionType });
}

async function updateStatus(id, status) {
  const { rows } = await query(
    `UPDATE customers SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return rows[0] || null;
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
  fields.push(`updated_at = now()`);
  values.push(id);
  const { rows } = await query(
    `UPDATE customers SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    values
  );
  return rows[0] || null;
}

module.exports = { findAll, findById, findByPhone, create, findOrCreateByPhone, updateStatus, update };
