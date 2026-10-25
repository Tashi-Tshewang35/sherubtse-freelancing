const bcrypt = require('bcrypt');
const db = require('../config/db');

async function ensureAdmin() {
  const name = (process.env.ADMIN_NAME || 'System Administrator').trim();
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!email || !password) {
    console.warn('Admin bootstrap skipped: set ADMIN_EMAIL and ADMIN_PASSWORD in Render.');
    return null;
  }
  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw Object.assign(new Error('ADMIN_PASSWORD must contain 8 to 72 bytes.'), {
      code: 'CONFIGURATION_ERROR',
    });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await db.one(
    `INSERT INTO users
      (name, email, password_hash, is_admin, is_verified, employer_status)
     VALUES ($1, $2, $3, true, true, 'not_requested')
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name,
       password_hash = EXCLUDED.password_hash,
       is_admin = true,
       is_verified = true
     RETURNING id, name, email`,
    [name, email, passwordHash]
  );
  console.log('Production administrator is ready.');
  return admin;
}

module.exports = { ensureAdmin };
