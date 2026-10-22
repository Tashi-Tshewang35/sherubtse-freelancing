// Creates only the two explicitly named test databases; never drops a database.
require('../config/testEnvironment').loadTestEnvironment();
const fs = require('fs');
const path = require('path');
const pgp = require('pg-promise')();
const { MongoClient } = require('mongodb');
const { TEST_POSTGRES, TEST_MONGO } = require('../config/testEnvironment');

async function setup() {
  const connection = process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
    host: process.env.DB_HOST, port: Number(process.env.DB_PORT),
    database: TEST_POSTGRES, user: process.env.DB_USER, password: process.env.DB_PASS,
  };
  if (process.env.DB_SSL === 'true') connection.ssl = { rejectUnauthorized: true };
  // To create a database, use the maintenance database on the same server.
  const maintenance = { ...connection, database: process.env.TEST_DB_ADMIN_NAME || 'postgres' };
  if (connection.connectionString) {
    const url = new URL(connection.connectionString);
    url.pathname = '/' + maintenance.database;
    maintenance.connectionString = url.href;
  }
  const admin = pgp(maintenance);
  let target;
  let mongo;
  try {
    const exists = await admin.oneOrNone('SELECT 1 FROM pg_database WHERE datname=$1', [TEST_POSTGRES]);
    if (!exists) await admin.none('CREATE DATABASE $1:name', [TEST_POSTGRES]);
    target = pgp(connection);
    // Bootstrap an empty test database. Existing upgraded test data is retained.
    const ready = await target.one("SELECT to_regclass('public.notifications') IS NOT NULL AS ready");
    if (!ready.ready) {
      for (const name of ['postgresql_schema.sql', 'migrations/001_professional_upgrade.sql']) {
        await target.none(fs.readFileSync(path.join(__dirname, '../database', name), 'utf8'));
      }
    } else {
      await target.none(fs.readFileSync(path.join(__dirname, '../database/migrations/001_professional_upgrade.sql'), 'utf8'));
    }
    mongo = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await mongo.connect();
    await mongo.db(TEST_MONGO).collection('ratings').createIndex({ employeeId: 1 });
    await mongo.db(TEST_MONGO).collection('ratings').createIndex({ applicationId: 1, employerId: 1 }, { unique: true });
    console.log('Separate PostgreSQL and MongoDB test databases are ready. No development database was changed.');
  } finally {
    if (mongo) await mongo.close();
    await pgp.end();
  }
}
setup().catch(() => {
  console.error('Test setup failed. Check .env.test, local services and database-creation permission. You may create the test database in pgAdmin instead.');
  process.exitCode = 1;
});
