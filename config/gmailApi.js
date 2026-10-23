const MailComposer = require('nodemailer/lib/mail-composer');

async function providerJson(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(30000) });
  if (!response.ok) {
    throw Object.assign(new Error('Gmail API request failed'), { code: 'EMAIL_PROVIDER', statusCode: response.status });
  }
  // Do not log responses: OAuth payloads include private tokens.
  return response.json();
}

async function sendGmailApi(message) {
  const credentials = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID.trim(),
    client_secret: process.env.GOOGLE_CLIENT_SECRET.trim(),
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN.trim(),
    grant_type: 'refresh_token',
  });
  const auth = await providerJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: credentials.toString(),
  });
  if (!auth?.access_token) {
    throw Object.assign(new Error('Gmail authorization missing'), { code: 'EMAIL_AUTH' });
  }
  const mime = await new MailComposer({ ...message, disableFileAccess: true, disableUrlAccess: true }).compile().build();
  const result = await providerJson('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + auth.access_token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw: mime.toString('base64url') }),
  });
  if (!result?.id) {
    throw Object.assign(new Error('Gmail did not accept the message'), { code: 'EMAIL_REJECTED' });
  }
}
module.exports = { sendGmailApi };
