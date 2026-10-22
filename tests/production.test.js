require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { validateProduction } = require('../config/production');
const { connectMongo, closeMongo, getMongoDb } = require('../config/mongo');
const MongoSessionStore = require('../config/sessionStore');

test('production requires secrets, hosted databases and HTTPS', () => {
  const env = { NODE_ENV: 'production', SESSION_SECRET: 'a'.repeat(48),
    APP_URL: 'https://freelance.example.com', MONGODB_URI: 'mongodb://database',
    GMAIL_USER: 'sender@gmail.com', GMAIL_APP_PASSWORD: 'test-only-password',
    DATABASE_URL: 'postgresql://database' };
  assert.doesNotThrow(() => validateProduction(env));
  assert.throws(() => validateProduction({ ...env, APP_URL: 'http://localhost:3000' }), /HTTPS/);
  assert.throws(() => validateProduction({ ...env, SESSION_SECRET: 'short' }), /32/);
  assert.throws(() => validateProduction({ ...env, GMAIL_APP_PASSWORD: '' }), /GMAIL_APP_PASSWORD/);
  assert.doesNotThrow(() => validateProduction({ NODE_ENV: 'development' }));
});

test('MongoDB sessions survive new store instances, expire and can be destroyed', async () => {
  const id = 'test-' + crypto.randomUUID();
  const invoke = (store, method, ...args) => new Promise((resolve, reject) => {
    store[method](...args, (error, value) => error ? reject(error) : resolve(value));
  });
  try {
    await connectMongo();
    const first = new MongoSessionStore(), second = new MongoSessionStore();
    const data = { user: { id: 123, name: 'Session test' }, cookie: { expires: new Date(Date.now() + 60000) } };
    await invoke(first, 'set', id, data);
    assert.equal((await invoke(second, 'get', id)).user.id, 123);
    await invoke(second, 'touch', id, { cookie: { expires: new Date(Date.now() - 1000) } });
    assert.equal(await invoke(first, 'get', id), null);
    await invoke(first, 'set', id, data);
    await invoke(second, 'destroy', id);
    assert.equal(await invoke(first, 'get', id), null);
    const indexes = await getMongoDb().collection('sessions').indexes();
    assert.ok(indexes.some(index => index.key.expiresAt === 1 && index.expireAfterSeconds === 0));
  } finally {
    if (getMongoDb) {
      try { await getMongoDb().collection('sessions').deleteOne({ _id: id }); } catch (_) { /* Connection failed. */ }
    }
    await closeMongo();
  }
});
