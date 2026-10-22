const { MongoClient } = require('mongodb');

let client;
let database;

async function connectMongo() {
  if (database) return database;

  client = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
  await client.connect();
  database = client.db(process.env.MONGODB_DB || 'sherubtse_freelance_feedback');
  await database.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await database.collection('ratings').createIndex({ employeeId: 1 });
  await database.collection('ratings').createIndex({ applicationId: 1, employerId: 1 }, { unique: true });
  console.log('MongoDB connected');
  return database;
}

function getMongoDb() {
  if (!database) throw new Error('MongoDB has not been connected yet.');
  return database;
}

async function closeMongo() {
  if (client) await client.close();
  database = undefined;
  client = undefined;
}

module.exports = { connectMongo, getMongoDb, closeMongo };
