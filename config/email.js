function emailProvider(env = process.env) {
  const oauthReady = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN']
    .every(key => env[key]?.trim());
  const automatic = env.RESEND_API_KEY ? 'resend' : oauthReady ? 'gmail-api' : 'gmail';
  const provider = (env.EMAIL_PROVIDER || automatic).trim().toLowerCase();
  if (!['gmail', 'gmail-api', 'resend'].includes(provider)) {
    throw Object.assign(new Error('EMAIL_PROVIDER must be gmail, gmail-api or resend.'), { code: 'EMAIL_CONFIG' });
  }
  return provider;
}
module.exports = { emailProvider };
