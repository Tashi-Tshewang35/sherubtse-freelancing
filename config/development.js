// Used only by npm run dev. Local .env settings take priority over inherited
// shell variables so a previous test/cloud connection cannot select another DB.
const path = require('path');
const loaded = require('dotenv').config({ path: path.join(__dirname, '../.env'), override: true });
if (loaded.error) throw new Error('Local development requires a readable .env file.');
const local = loaded.parsed;
if (!Object.prototype.hasOwnProperty.call(local, 'DATABASE_URL') && local.DB_NAME && local.DB_HOST) {
  delete process.env.DATABASE_URL;
}
process.env.NODE_ENV = 'development';
