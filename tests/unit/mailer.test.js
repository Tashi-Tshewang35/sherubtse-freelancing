const { sendVerificationEmail } = require('../../config/mailer');
const { emailProvider } = require('../../config/email');
const { validateProduction } = require('../../config/production');
const originalEnv = { ...process.env };
const originalFetch = global.fetch;
const token = 'a'.repeat(64);

beforeEach(() => {
  process.env.EMAIL_PROVIDER = 'resend';
  process.env.RESEND_API_KEY = 're_test_only';
  process.env.EMAIL_FROM = 'Sherubtse <noreply@example.com>';
  process.env.APP_URL = 'https://freelance.example.com';
  global.fetch = jest.fn();
});
afterEach(() => { process.env = { ...originalEnv }; global.fetch = originalFetch; });

test('sends the public verification link over HTTPS without SMTP', async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'test-message' }) });
  await sendVerificationEmail('recipient@example.com', token);
  const [url, options] = global.fetch.mock.calls[0];
  expect(url).toBe('https://api.resend.com/emails');
  expect(options.method).toBe('POST');
  expect(options.headers.Authorization).toBe('Bearer re_test_only');
  const message = JSON.parse(options.body);
  expect(message.to).toEqual(['recipient@example.com']);
  expect(message.from).toBe(process.env.EMAIL_FROM);
  expect(message.text).toContain('https://freelance.example.com/verify/' + token);
  expect(message.html).toContain('href="https://freelance.example.com/verify/' + token + '"');
});

test.each([401, 403, 429, 500])('rejects HTTP %s so registration can offer a retry', async status => {
  global.fetch.mockResolvedValue({ ok: false, status });
  await expect(sendVerificationEmail('recipient@example.com', token)).rejects.toMatchObject({ code: 'EMAIL_PROVIDER', statusCode: status });
});

test('does not report successful delivery for an empty provider response', async () => {
  global.fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
  await expect(sendVerificationEmail('recipient@example.com', token)).rejects.toMatchObject({ code: 'EMAIL_REJECTED' });
});

test('propagates network failure without silently falling back to SMTP', async () => {
  global.fetch.mockRejectedValue(new Error('Network unavailable'));
  await expect(sendVerificationEmail('recipient@example.com', token)).rejects.toThrow('Network unavailable');
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test.each(['RESEND_API_KEY', 'EMAIL_FROM'])('requires %s before contacting the provider', async key => {
  delete process.env[key];
  await expect(sendVerificationEmail('recipient@example.com', token)).rejects.toMatchObject({ code: 'EMAIL_CONFIG' });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('production Resend configuration does not require Gmail credentials', () => {
  const env = { NODE_ENV: 'production', EMAIL_PROVIDER: 'resend', RESEND_API_KEY: 're_test_only',
    EMAIL_FROM: 'noreply@example.com', SESSION_SECRET: 'a'.repeat(48),
    MONGODB_URI: 'mongodb://test-database', DATABASE_URL: 'postgresql://test-database',
    APP_URL: 'https://freelance.example.com' };
  expect(() => validateProduction(env)).not.toThrow();
  expect(() => validateProduction({ ...env, EMAIL_FROM: '' })).toThrow('EMAIL_FROM');
  expect(() => validateProduction({ ...env, EMAIL_PROVIDER: 'unsupported' })).toThrow('EMAIL_PROVIDER');
});

test('provider selection keeps Gmail compatibility and recognizes an API key', () => {
  expect(emailProvider({})).toBe('gmail');
  expect(emailProvider({ RESEND_API_KEY: 're_test_only' })).toBe('resend');
  expect(emailProvider({ EMAIL_PROVIDER: 'gmail', RESEND_API_KEY: 're_test_only' })).toBe('gmail');
});
