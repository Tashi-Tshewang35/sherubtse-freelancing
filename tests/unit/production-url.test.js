const { spawnSync } = require('child_process');
const path = require('path');
const { configureProduction, validateProduction } = require('../../config/production');
function settings() {
  return { NODE_ENV: 'production', SESSION_SECRET: 'a'.repeat(48),
    MONGODB_URI: 'mongodb://test-database', GMAIL_USER: 'sender@example.invalid',
    GMAIL_APP_PASSWORD: 'test-only-password', DATABASE_URL: 'postgresql://test-database',
    RENDER_EXTERNAL_URL: 'https://unit6-fixture.onrender.com' };
}
test.each([undefined, '', 'https://your-public-domain.example', 'your_public_url'])('uses Render URL when APP_URL is missing or a placeholder: %p', value => {
  const env = { ...settings(), APP_URL: value };
  configureProduction(env);
  expect(env.APP_URL).toBe('https://unit6-fixture.onrender.com');
});
test('explicit custom HTTPS domain takes priority and shares the verification origin', () => {
  const env = { ...settings(), APP_URL: 'https://freelancing.example.com/' };
  configureProduction(env);
  expect(env.APP_URL).toBe('https://freelancing.example.com');
  expect(new URL('/verify/test-token', env.APP_URL).href).toBe('https://freelancing.example.com/verify/test-token');
});
test.each(['not-a-url', 'http://localhost:3000', 'https://localhost', 'https://user:password@example.com', 'https://example.com/path', 'https://example.com?token=secret'])('rejects unsafe/invalid public address %s', value => {
  expect(() => validateProduction({ ...settings(), APP_URL: value })).toThrow(/HTTPS/);
});
test('without a real URL or Render, production reports the missing configuration', () => {
  expect(() => validateProduction({ ...settings(), RENDER_EXTERNAL_URL: undefined })).toThrow(/APP_URL/);
});
test('lists all missing production settings at once', () => {
  try { validateProduction({ NODE_ENV: 'production' }); }
  catch (error) {
    expect(error.code).toBe('CONFIGURATION_ERROR');
    for (const key of ['SESSION_SECRET','APP_URL','MONGODB_URI','GMAIL_USER','GMAIL_APP_PASSWORD','DATABASE_URL']) expect(error.message).toContain(key);
    return;
  }
  throw new Error('Expected missing production configuration to be rejected.');
});
test('local development is not silently converted to production', () => {
  const env = { NODE_ENV: 'development', APP_URL: 'http://localhost:3000' };
  configureProduction(env);
  expect(env.APP_URL).toBe('http://localhost:3000');
});
test('startup prints an actionable configuration message without an uncaught stack or database connection', () => {
  const env = { ...process.env, NODE_ENV: 'production', APP_URL: '', RENDER_EXTERNAL_URL: '',
    SESSION_SECRET: '', MONGODB_URI: '', GMAIL_USER: '', GMAIL_APP_PASSWORD: '',
    DATABASE_URL: '', DB_HOST: '', DB_NAME: '', DB_USER: '', DB_PASS: '' };
  const result = spawnSync(process.execPath, ['server.js'], { cwd: path.join(__dirname, '../..'), env, encoding: 'utf8', windowsHide: true, timeout: 5000 });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('Startup failed: Production configuration needs attention:');
  expect(result.stderr).toContain('APP_URL');
  expect(result.stderr).not.toMatch(/\n\s+at |throw new Error|node:internal/);
});
