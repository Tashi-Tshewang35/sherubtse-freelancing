function emailProvider(env = process.env) {
  const provider = (env.EMAIL_PROVIDER || (env.RESEND_API_KEY ? 'resend' : 'gmail')).trim().toLowerCase();
  if (!['gmail', 'gmail-api', 'resend'].includes(provider)) {
    throw Object.assign(new Error('EMAIL_PROVIDER must be gmail, gmail-api or resend.'), { code: 'EMAIL_CONFIG' });
  }
  return provider;
}
module.exports = { emailProvider };
