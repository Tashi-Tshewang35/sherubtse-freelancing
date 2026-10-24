const { MongoClient } = require('mongodb');
let client;
let database;
let connecting;

async function connectMongo() {
  if (process.env.NODE_ENV === 'test') require('./testEnvironment').assertTestDatabases(process.env);
  if (database) return database;
  if (connecting) return connecting;
  connecting = (async () => {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI ||
      (process.env.NODE_ENV !== 'production' ? 'mongodb://127.0.0.1:27017' : null);
    if (!mongoUri) throw Object.assign(new Error('Set MONGO_URI in the hosting environment.'), { code: 'CONFIGURATION_ERROR' });
    client = new MongoClient(mongoUri, { serverSelectionTimeoutMS: 5000 });
    try {
      await client.connect();
      const selected = client.db(process.env.MONGODB_DB || 'sherubtse_freelance_feedback');
      // createIndex is safe to repeat. Duplicates are reported, never silently deleted.
      await selected.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await selected.collection('ratings').createIndex({ employeeId: 1 });
      await selected.collection('ratings').createIndex({ applicationId: 1, employerId: 1 }, { unique: true });
      database = selected;
      console.log('MongoDB connected');
      return database;
    } catch (error) {
      await client.close();
      client = undefined;
      throw error;
    }
  })();
  try { return await connecting; }
  finally { connecting = undefined; }
}
function getMongoDb() {
  if (!database) throw new Error('MongoDB has not been connected yet.');
  return database;
}
async function closeMongo() {
  if (connecting) await connecting.catch(() => {});
  if (client) await client.close();
  database = undefined;
  client = undefined;
}
module.exports = { connectMongo, getMongoDb, closeMongo };
