const { query } = require('../db/pool');

async function findAll({ activeOnly = true, connectionType, planType } = {}) {
  const conditions = [];
  const values = [];
  let i = 1;

  if (activeOnly) conditions.push('is_active = true');
  if (connectionType) { conditions.push(`connection_type = $${i++}`); values.push(connectionType); }
  if (planType) { conditions.push(`plan_type = $${i++}`); values.push(planType); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(`SELECT * FROM plans ${where} ORDER BY price ASC`, values);
  return rows;
}

async function findById(id) {
  const { rows } = await query('SELECT * FROM plans WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create(data) {
  const {
    name, planType, connectionType, price, durationValue, durationUnit,
    dataCapMb, downloadSpeed, uploadSpeed, rateLimit, mikrotikProfile,
  } = data;
  const { rows } = await query(
    `INSERT INTO plans
      (name, plan_type, connection_type, price, duration_value, duration_unit,
       data_cap_mb, download_speed, upload_speed, rate_limit, mikrotik_profile)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [name, planType, connectionType, price, durationValue, durationUnit,
     dataCapMb, downloadSpeed, uploadSpeed, rateLimit, mikrotikProfile]
  );
  return rows[0];
}

async function setActive(id, isActive) {
  const { rows } = await query(
    'UPDATE plans SET is_active = $1 WHERE id = $2 RETURNING *',
    [isActive, id]
  );
  return rows[0] || null;
}

/** Convert a plan's duration into milliseconds, for computing expiry. */
function durationToMs(plan) {
  const unitMs = { minutes: 60_000, hours: 3_600_000, days: 86_400_000, months: 30 * 86_400_000 };
  return (plan.duration_value || 0) * (unitMs[plan.duration_unit] || 0);
}

module.exports = { findAll, findById, create, setActive, durationToMs };
