const nodemailer = require('nodemailer');

async function sendVerificationEmail(toEmail, token) {
  try {
    const sender = process.env.GMAIL_USER;
    const password = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
    if (!sender || !password || sender.startsWith('your_') || password.startsWith('your_')) {
      throw Object.assign(new Error('Gmail configuration missing'), { code: 'EMAIL_CONFIG' });
    }
    const baseUrl = new URL(process.env.APP_URL || 'http://localhost:3000');
    if (!['http:', 'https:'].includes(baseUrl.protocol) || baseUrl.username || baseUrl.password) {
      throw Object.assign(new Error('Invalid APP_URL'), { code: 'APP_URL_CONFIG' });
    }
    const link = new URL('/verify/' + encodeURIComponent(token), baseUrl).href;
    const safeLink = link.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const transporter = nodemailer.createTransport({ service: 'gmail',
      auth: { user: sender, pass: password }, connectionTimeout: 15000, greetingTimeout: 15000, socketTimeout: 30000 });
    const info = await transporter.sendMail({
      from: { name: 'Sherubtse Freelancing', address: sender }, to: toEmail,
      subject: 'Verify your Sherubtse Freelancing account',
      text: 'Verify your account within 24 hours: ' + link + '\nIf you did not register, ignore this email.',
      html: '<h2>Welcome to Sherubtse Freelancing</h2><p>Verify your email to activate your account. This link expires in 24 hours.</p><p><a href="' + safeLink + '">Verify my email</a></p><p>If you did not register, ignore this email.</p>',
    });
    if (info.rejected?.length || !info.accepted?.length) {
      throw Object.assign(new Error('Recipient not accepted'), { code: 'EMAIL_REJECTED' });
    }
    console.log('[Verification email] Gmail accepted the message for delivery.');
  } catch (error) {
    console.error('[Verification email] Sending failed:', {
      code: error.code || 'UNKNOWN', smtpStatus: error.responseCode || null,
      action: 'Check GMAIL_USER, GMAIL_APP_PASSWORD, APP_URL and network access. The account can retry through resend verification.',
    });
    throw error;
  }
}
module.exports = { sendVerificationEmail };
