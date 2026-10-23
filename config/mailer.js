const nodemailer = require('nodemailer');
const { emailProvider } = require('./email');

async function sendVerificationEmail(toEmail, token) {
  try {
    const provider = emailProvider();
    const sender = (process.env.GMAIL_USER || '').trim();
    const password = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
    const apiKey = (process.env.RESEND_API_KEY || '').trim();
    const from = (process.env.EMAIL_FROM || '').trim();
    if (provider === 'resend' ? (!apiKey || !from || apiKey.startsWith('your_')) :
        (!sender || !password || sender.startsWith('your_') || password.startsWith('your_'))) {
      throw Object.assign(new Error('Email configuration missing'), { code: 'EMAIL_CONFIG' });
    }
    const baseUrl = new URL(process.env.APP_URL || 'http://localhost:3000');
    if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
      throw Object.assign(new Error('Invalid APP_URL'), { code: 'APP_URL_CONFIG' });
    }
    const link = new URL('/verify/' + encodeURIComponent(token), baseUrl).href;
    const safeLink = link.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const message = {
      to: [toEmail],
      subject: 'Verify your Sherubtse Freelancing account',
      text: 'Verify your account within 24 hours: ' + link + '\nIf you did not register, ignore this email.',
      html: '<h2>Welcome to Sherubtse Freelancing</h2><p>Verify your email to activate your account. This link expires in 24 hours.</p><p><a href="' + safeLink + '">Verify my email</a></p><p>If you did not register, ignore this email.</p>',
    };
    if (provider === 'resend') {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...message, from }),
        signal: AbortSignal.timeout(30000),
      });
      // Do not expose provider responses: they may contain addresses or secrets.
      if (!response.ok) {
        throw Object.assign(new Error('Email provider rejected the request'), {
          code: 'EMAIL_PROVIDER', statusCode: response.status,
        });
      }
      const result = await response.json();
      if (!result?.id) throw Object.assign(new Error('Email provider did not accept the message'), { code: 'EMAIL_REJECTED' });
    } else {
      const transporter = nodemailer.createTransport({ service: 'gmail',
        auth: { user: sender, pass: password }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000 });
      const info = await transporter.sendMail({ ...message, to: toEmail,
        from: { name: 'Sherubtse Freelancing', address: sender } });
      if (info.rejected?.length || !info.accepted?.length) {
        throw Object.assign(new Error('Recipient not accepted'), { code: 'EMAIL_REJECTED' });
      }
    }
    console.log('[Verification email] Provider accepted the message for delivery.');
  } catch (error) {
    console.error('[Verification email] Sending failed:', {
      code: error.code || 'UNKNOWN', smtpStatus: error.responseCode || null,
      httpStatus: error.statusCode || null,
      action: 'Check the selected email provider credentials, sender, APP_URL and network access. Retry through resend verification.',
    });
    throw error;
  }
}
module.exports = { sendVerificationEmail };
