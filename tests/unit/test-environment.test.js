const { assertTestDatabases } = require('../../config/testEnvironment');
const safe = { DB_NAME: 'sherubtse_freelance_test_db', MONGODB_DB: 'sherubtse_freelance_test_feedback' };
test('permits only the explicitly named test databases', () => {
  expect(() => assertTestDatabases(safe)).not.toThrow();
  expect(() => assertTestDatabases({ ...safe, DB_NAME: 'sherubtse_freelance_db' })).toThrow('No database operation');
  expect(() => assertTestDatabases({ ...safe, MONGODB_DB: 'sherubtse_freelance_feedback' })).toThrow('No database operation');
  expect(() => assertTestDatabases({ ...safe, DATABASE_URL: 'postgresql://localhost/production' })).toThrow('No database operation');
  expect(() => assertTestDatabases({ ...safe, TEST_BASE_URL: 'https://example.com' })).toThrow('TEST_BASE_URL');
});
