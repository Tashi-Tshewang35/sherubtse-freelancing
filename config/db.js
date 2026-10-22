const pgp = require('pg-promise')();
if (process.env.NODE_ENV !== 'test') require('dotenv').config();
else require('./testEnvironment').assertTestDatabases(process.env);

const connection = process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'sherubtse_freelance_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS,
};
if (process.env.DB_SSL === 'true') connection.ssl = { rejectUnauthorized: true };
const db = pgp(connection);

module.exports = db;
