const { query } = require('../db/pool');

async function create({ customerId, routerId, planId, username, password, profile, nextDueDate }) {
  const { rows } = await query(
    `INSERT INTO pppoe_accounts
      (customer_id, router_id, plan_id, username, password, profile, next_due_date)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [customerId, routerId, planId, username, password, profile, nextDueDate]
  );
  return rows[0];
}

async function findById(id) {
  const { rows } = await query('SELECT * FROM pppoe_accounts WHERE id = $1', [id]);
  return rows[0] || null;
}

async function findByUsername(username) {
  const { rows } = await query('SELECT * FROM pppoe_accounts WHERE username = $1', [username]);
  return rows[0] || null;
}

async function findByCustomer(customerId) {
  const { rows } = await query('SELECT * FROM pppoe_accounts WHERE customer_id = $1', [customerId]);
  return rows;
}

async function updateStatus(id, status) {
  const { rows } = await query(
    `UPDATE pppoe_accounts SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return rows[0] || null;
}

async function renew(id, { nextDueDate, planId }) {
  const { rows } = await query(
    `UPDATE pppoe_accounts
     SET status = 'active', next_due_date = $1, plan_id = COALESCE($2, plan_id), updated_at = now()
     WHERE id = $3 RETURNING *`,
    [nextDueDate, planId, id]
  );
  return rows[0] || null;
}

async function findDueForSuspension() {
  const { rows } = await query(
    `SELECT * FROM pppoe_accounts WHERE status = 'active' AND next_due_date < CURRENT_DATE`
  );
  return rows;
}

module.exports = {
  create, findById, findByUsername, findByCustomer,
  updateStatus, renew, findDueForSuspension,
};
