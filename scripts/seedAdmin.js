require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../config/db');

async function seedAdmin() {
  const name = process.env.ADMIN_NAME || 'System Administrator';
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env first.');
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await db.one(
    `INSERT INTO users
      (name, email, password_hash, is_admin, is_verified, employer_status)
     VALUES ($1,$2,$3,true,true,'not_requested')
     ON CONFLICT (email) DO UPDATE SET
       name = EXCLUDED.name, password_hash = EXCLUDED.password_hash,
       is_admin = true, is_verified = true
     RETURNING id, name, email`,
    [name, email.toLowerCase(), passwordHash]
  );
  console.log(`Admin ready: ${admin.email}`);
}

seedAdmin()
  .catch(error => { console.error(error.message); process.exitCode = 1; })
  .finally(() => db.$pool.end());
