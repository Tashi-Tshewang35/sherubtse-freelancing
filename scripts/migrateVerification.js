require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
db.none(fs.readFileSync(path.join(__dirname, '../database/verification_migration.sql'), 'utf8'))
  .then(() => console.log('Verification migration completed.'))
  .catch(error => { console.error('Verification migration failed:', error.message); process.exitCode = 1; })
  .finally(() => db.$pool.end());
