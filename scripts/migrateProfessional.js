require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const db = require('../config/db');

async function migrate() {
  const backupDir = path.join(__dirname, '../backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backup = path.join(backupDir, `before-professional-upgrade-${Date.now()}.dump`);
  const candidates = process.platform === 'win32' ? [
    process.env.PG_DUMP_PATH,
    'C:/Program Files/PostgreSQL/18/bin/pg_dump.exe',
    'C:/Program Files/PostgreSQL/17/bin/pg_dump.exe',
    'C:/Program Files/PostgreSQL/16/bin/pg_dump.exe',
  ].filter(Boolean) : [process.env.PG_DUMP_PATH || 'pg_dump'];
  const executable = candidates.find(candidate => candidate === 'pg_dump' || fs.existsSync(candidate));
  if (!executable) throw new Error('Set PG_DUMP_PATH to pg_dump so the database can be backed up first.');
  const env = { ...process.env };
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    env.PGHOST = url.hostname;
    env.PGPORT = url.port || '5432';
    env.PGDATABASE = decodeURIComponent(url.pathname.slice(1));
    env.PGUSER = decodeURIComponent(url.username);
    env.PGPASSWORD = decodeURIComponent(url.password);
    if (url.searchParams.get('sslmode')) env.PGSSLMODE = url.searchParams.get('sslmode');
  } else {
    env.PGHOST = process.env.DB_HOST || 'localhost';
    env.PGPORT = process.env.DB_PORT || '5432';
    env.PGDATABASE = process.env.DB_NAME || 'sherubtse_freelance_db';
    env.PGUSER = process.env.DB_USER || 'postgres';
    env.PGPASSWORD = process.env.DB_PASS || '';
  }
  const result = spawnSync(executable, ['--format=custom', '--no-password', '--file', backup], { env, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error('Database backup failed. Check pg_dump version and database connectivity. No migration was applied.');
  console.log('Database backup saved:', backup);
  await db.none(fs.readFileSync(path.join(__dirname, '../database/migrations/001_professional_upgrade.sql'), 'utf8'));
  console.log('Professional migration completed. Existing data retained.');
}
migrate().catch(error => {
  console.error('Migration failed:', error.code || error.message);
  process.exitCode = 1;
}).finally(() => db.$pool.end());
