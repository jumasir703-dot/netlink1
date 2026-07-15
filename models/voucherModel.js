const { query } = require('../db/pool');

async function create({ code, planId, routerId }) {
  const { rows } = await query(
    `INSERT INTO vouchers (code, plan_id, router_id) VALUES ($1,$2,$3) RETURNING *`,
    [code, planId, routerId]
  );
  return rows[0];
}

async function findByCode(code) {
  const { rows } = await query('SELECT * FROM vouchers WHERE code = $1', [code]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await query('SELECT * FROM vouchers WHERE id = $1', [id]);
  return rows[0] || null;
}

async function activate(id, { customerId, expiresAt }) {
  const { rows } = await query(
    `UPDATE vouchers
     SET status = 'active', customer_id = $1, activated_at = now(), expires_at = $2
     WHERE id = $3 RETURNING *`,
    [customerId, expiresAt, id]
  );
  return rows[0] || null;
}

async function markUsed(id) {
  const { rows } = await query(
    `UPDATE vouchers SET status = 'used' WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

async function findExpiredActive() {
  const { rows } = await query(
    `SELECT * FROM vouchers WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at < now()`
  );
  return rows;
}

async function markExpired(id) {
  const { rows } = await query(
    `UPDATE vouchers SET status = 'expired' WHERE id = $1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
}

module.exports = { create, findByCode, findById, activate, markUsed, findExpiredActive, markExpired };
