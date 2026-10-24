if (process.env.NODE_ENV !== 'test') require('dotenv').config();
let db;
let mongo;

async function start() {
  // Validate inside the caught startup promise, before loading/connecting databases.
  require('./config/production').configureProduction();
  const app = require('./app');
  db = require('./config/db');
  mongo = require('./config/mongo');
  await require('./config/checkSchema').checkSchema();
  await mongo.connectMongo();
  await require('./services/adminBootstrap').ensureAdmin();
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      console.log(`Sherubtse Freelancing running at ${process.env.APP_URL || `http://localhost:${port}`} (website and email verification)`);
      resolve(server);
    });
    server.once('error', reject);
  });
}

async function closeDatabases() {
  await Promise.all([mongo ? mongo.closeMongo() : Promise.resolve(), db ? db.$pool.end() : Promise.resolve()]);
}

if (require.main === module) {
  start().then(server => {
    let stopping = false;
    function shutdown() {
      if (stopping) return;
      stopping = true;
      server.close(() => closeDatabases().catch(() => { process.exitCode = 1; }));
    }
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  }).catch(async error => {
    // Schema guidance is safe; database errors and URLs may contain credentials.
    console.error('Startup failed:', error.code === 'CONFIGURATION_ERROR' ? error.message :
      error.code === 'EADDRINUSE' ? `Port ${process.env.PORT || 3000} is already in use. Stop the other app server, then restart this one. Run only one npm start or npm run dev session.` :
      error.message?.startsWith('Database upgrade required:') ? error.message :
      'Check database connectivity, schema and required environment variables.');
    await closeDatabases().catch(() => {});
    process.exitCode = 1;
  });
}
module.exports = { start };
