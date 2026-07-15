const { query } = require('../db/pool');

async function findByEmail(email) {
  const { rows } = await query('SELECT * FROM admins WHERE email = $1', [email]);
  return rows[0] || null;
}

async function findById(id) {
  const { rows } = await query('SELECT id, name, email, role, created_at FROM admins WHERE id = $1', [id]);
  return rows[0] || null;
}

async function create({ name, email, passwordHash, role = 'admin' }) {
  const { rows } = await query(
    `INSERT INTO admins (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, created_at`,
    [name, email, passwordHash, role]
  );
  return rows[0];
}

module.exports = { findByEmail, findById, create };
