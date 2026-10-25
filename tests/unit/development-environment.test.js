const originalEnv = { ...process.env };
afterEach(() => { process.env = { ...originalEnv }; jest.dontMock('dotenv'); jest.resetModules(); });
function preload(local, error) {
  jest.doMock('dotenv', () => ({ config: jest.fn(options => {
    expect(options.override).toBe(true);
    if (local) Object.assign(process.env, local);
    return { parsed: local, error };
  }) }));
  jest.isolateModules(() => require('../../config/development'));
}
test('local DB fields displace a leftover hosted database URL in development', () => {
  process.env.DATABASE_URL = 'postgresql://unrelated-host/unrelated_database';
  process.env.DB_NAME = 'old_database';
  process.env.NODE_ENV = 'production';
  preload({ DB_NAME: 'local_database', DB_HOST: '127.0.0.1' });
  expect(process.env.DATABASE_URL).toBeUndefined();
  expect(process.env.DB_NAME).toBe('local_database');
  expect(process.env.NODE_ENV).toBe('development');
});
test('an explicitly configured local database URL is respected', () => {
  preload({ DATABASE_URL: 'postgresql://127.0.0.1/local_database' });
  expect(process.env.DATABASE_URL).toBe('postgresql://127.0.0.1/local_database');
});
test('an inherited Mongo alias cannot override the local Mongo configuration', () => {
  process.env.MONGO_URI='mongodb://unrelated-host/unrelated_database';
  preload({MONGODB_URI:'mongodb://127.0.0.1/local_database'});
  expect(process.env.MONGO_URI).toBeUndefined();
  expect(process.env.MONGODB_URI).toBe('mongodb://127.0.0.1/local_database');
});
test('missing local environment fails instead of connecting using inherited credentials', () => {
  expect(() => preload(undefined, new Error('ENOENT'))).toThrow('Local development requires a readable .env file.');
});
