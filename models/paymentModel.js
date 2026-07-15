const { query } = require('../db/pool');

async function create({ customerId, planId, phone, amount, merchantRequestId, checkoutRequestId }) {
  const { rows } = await query(
    `INSERT INTO payments
      (customer_id, plan_id, phone, amount, merchant_request_id, checkout_request_id, status)
     VALUES ($1,$2,$3,$4,$5,$6,'pending') RETURNING *`,
    [customerId, planId, phone, amount, merchantRequestId, checkoutRequestId]
  );
  return rows[0];
}

async function findByCheckoutId(checkoutRequestId) {
  const { rows } = await query('SELECT * FROM payments WHERE checkout_request_id = $1', [checkoutRequestId]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await query('SELECT * FROM payments WHERE id = $1', [id]);
  return rows[0] || null;
}

async function markSuccess(checkoutRequestId, { mpesaReceipt, resultDesc, rawCallback }) {
  const { rows } = await query(
    `UPDATE payments
     SET status = 'success', mpesa_receipt = $1, result_desc = $2, raw_callback = $3, updated_at = now()
     WHERE checkout_request_id = $4 RETURNING *`,
    [mpesaReceipt, resultDesc, rawCallback, checkoutRequestId]
  );
  return rows[0] || null;
}

async function markFailed(checkoutRequestId, { resultDesc, rawCallback }) {
  const { rows } = await query(
    `UPDATE payments
     SET status = 'failed', result_desc = $1, raw_callback = $2, updated_at = now()
     WHERE checkout_request_id = $3 RETURNING *`,
    [resultDesc, rawCallback, checkoutRequestId]
  );
  return rows[0] || null;
}

async function attachVoucher(paymentId, voucherId) {
  const { rows } = await query(
    `UPDATE payments SET voucher_id = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [voucherId, paymentId]
  );
  return rows[0] || null;
}

async function attachPppoeAccount(paymentId, pppoeAccountId) {
  const { rows } = await query(
    `UPDATE payments SET pppoe_account_id = $1, updated_at = now() WHERE id = $2 RETURNING *`,
    [pppoeAccountId, paymentId]
  );
  return rows[0] || null;
}

async function findAll({ status, limit = 100, offset = 0 } = {}) {
  const conditions = [];
  const values = [];
  let i = 1;
  if (status) { conditions.push(`status = $${i++}`); values.push(status); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit, offset);
  const { rows } = await query(
    `SELECT * FROM payments ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i}`,
    values
  );
  return rows;
}

/** Payment plus whatever access it granted (voucher code, or PPPoE username), for customer-facing status checks. */
async function findWithFulfillment(checkoutRequestId) {
  const { rows } = await query(
    `SELECT
       p.*,
       v.code AS voucher_code, v.expires_at AS voucher_expires_at,
       pa.username AS pppoe_username, pa.next_due_date AS pppoe_next_due_date
     FROM payments p
     LEFT JOIN vouchers v ON v.id = p.voucher_id
     LEFT JOIN pppoe_accounts pa ON pa.id = p.pppoe_account_id
     WHERE p.checkout_request_id = $1`,
    [checkoutRequestId]
  );
  return rows[0] || null;
}

module.exports = {
  create, findByCheckoutId, findById, markSuccess, markFailed,
  attachVoucher, attachPppoeAccount, findAll, findWithFulfillment,
};
