const { sendVerificationEmail } = require('../../config/mailer');
const { validateProduction } = require('../../config/production');
const originalEnv = { ...process.env };
const originalFetch = global.fetch;
beforeEach(() => {
  Object.assign(process.env, { EMAIL_PROVIDER: 'gmail-api', GMAIL_USER: 'sender@gmail.com',
    GMAIL_APP_PASSWORD: '', GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret',
    GOOGLE_REFRESH_TOKEN: 'test-refresh', APP_URL: 'https://freelance.example.com' });
  global.fetch = jest.fn();
});
afterEach(() => { process.env = { ...originalEnv }; global.fetch = originalFetch; });
const token = 'b'.repeat(64);
const recipient = 'student@example.com';
const accepted = value => ({ ok: true, json: async () => value });

test('refreshes OAuth access and sends a MIME message over HTTPS with the public verification link', async () => {
  global.fetch.mockResolvedValueOnce(accepted({ access_token: 'temporary-access' }))
    .mockResolvedValueOnce(accepted({ id: 'gmail-message' }));
  await sendVerificationEmail(recipient, token);
  const [authUrl, authOptions] = global.fetch.mock.calls[0];
  expect(authUrl).toBe('https://oauth2.googleapis.com/token');
  const params = new URLSearchParams(authOptions.body);
  expect(params.get('grant_type')).toBe('refresh_token');
  expect(params.get('refresh_token')).toBe('test-refresh');
  const [sendUrl, sendOptions] = global.fetch.mock.calls[1];
  expect(sendUrl).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  expect(sendOptions.headers.Authorization).toBe('Bearer temporary-access');
  const mime = Buffer.from(JSON.parse(sendOptions.body).raw, 'base64url').toString();
  expect(mime).toContain('To: student@example.com');
  expect(mime).toContain('From: Sherubtse Freelancing <sender@gmail.com>');
  expect(mime.replace(/=\r\n/g, '').replace(/=3D/g, '=')).toContain('https://freelance.example.com/verify/' + token);
  expect(mime).not.toContain('test-refresh');
});

test('invalid or revoked OAuth credentials fail before trying to send mail', async () => {
  global.fetch.mockResolvedValue({ ok: false, status: 400 });
  await expect(sendVerificationEmail(recipient, token)).rejects.toMatchObject({ code: 'EMAIL_PROVIDER', statusCode: 400 });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('missing access token is not treated as successful authorization', async () => {
  global.fetch.mockResolvedValue(accepted({}));
  await expect(sendVerificationEmail(recipient, token)).rejects.toMatchObject({ code: 'EMAIL_AUTH' });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test.each([403, 429, 500])('Gmail send HTTP %s permits the caller to recover and retry', async status => {
  global.fetch.mockResolvedValueOnce(accepted({ access_token: 'temporary-access' }))
    .mockResolvedValueOnce({ ok: false, status });
  await expect(sendVerificationEmail(recipient, token)).rejects.toMatchObject({ code: 'EMAIL_PROVIDER', statusCode: status });
});

test('requires a Gmail message id before reporting acceptance', async () => {
  global.fetch.mockResolvedValueOnce(accepted({ access_token: 'temporary-access' }))
    .mockResolvedValueOnce(accepted({}));
  await expect(sendVerificationEmail(recipient, token)).rejects.toMatchObject({ code: 'EMAIL_REJECTED' });
});

test.each(['GMAIL_USER', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'])('requires %s before requesting OAuth tokens', async key => {
  delete process.env[key];
  await expect(sendVerificationEmail(recipient, token)).rejects.toMatchObject({ code: 'EMAIL_CONFIG' });
  expect(global.fetch).not.toHaveBeenCalled();
});

test('production Gmail API needs OAuth credentials without SMTP or Resend settings', () => {
  const env = { ...process.env, NODE_ENV: 'production', SESSION_SECRET: 'a'.repeat(48),
    MONGODB_URI: 'mongodb://test-database', DATABASE_URL: 'postgresql://test-database' };
  expect(() => validateProduction(env)).not.toThrow();
  expect(() => validateProduction({ ...env, GOOGLE_REFRESH_TOKEN: '' })).toThrow('GOOGLE_REFRESH_TOKEN');
});
