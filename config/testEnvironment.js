const path = require('path');
const TEST_POSTGRES = 'sherubtse_freelance_test_db';
const TEST_MONGO = 'sherubtse_freelance_test_feedback';

function assertTestDatabases(env) {
  let postgres = env.DB_NAME;
  if (env.DATABASE_URL) postgres = decodeURIComponent(new URL(env.DATABASE_URL).pathname.slice(1));
  if (postgres !== TEST_POSTGRES || env.MONGODB_DB !== TEST_MONGO) {
    throw new Error('Tests require sherubtse_freelance_test_db and sherubtse_freelance_test_feedback. No database operation was allowed.');
  }
  // Old remote-workflow overrides must not redirect tests to a deployed app.
  if (env.TEST_BASE_URL) throw new Error('TEST_BASE_URL is not allowed: route tests must use the imported Express app.');
}

function loadTestEnvironment() {
  // Never load .env during tests. CI can supply these values without a file.
  require('dotenv').config({ path: path.join(__dirname, '../.env.test'), override: true });
  process.env.NODE_ENV = 'test';
  process.env.TZ = 'Asia/Thimphu';
  process.env.DB_NAME ||= TEST_POSTGRES;
  process.env.MONGODB_DB ||= TEST_MONGO;
  process.env.DB_HOST ||= '127.0.0.1';
  process.env.DB_PORT ||= '5432';
  process.env.DB_USER ||= 'postgres';
  process.env.DB_SSL ||= 'false';
  process.env.MONGODB_URI ||= 'mongodb://127.0.0.1:27017';
  process.env.SESSION_SECRET = 'unit6-test-only-session-secret-not-for-production';
  process.env.APP_URL = 'http://localhost:3000';
  process.env.EMAIL_PROVIDER = 'gmail';
  process.env.RESEND_API_KEY = '';
  process.env.EMAIL_FROM = '';
  for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN']) process.env[key] = '';
  process.env.GMAIL_USER = 'automated-tests@example.invalid';
  process.env.GMAIL_APP_PASSWORD = 'test-only-not-a-real-password';
  assertTestDatabases(process.env);
}
module.exports = { TEST_POSTGRES, TEST_MONGO, assertTestDatabases, loadTestEnvironment };
