const { emailProvider } = require('./email');
function placeholder(value) {
  return !value || /^(your_|replace-|development-)/i.test(value.trim()) ||
    /\.example(?:[/:?#]|$)/i.test(value) || /https?:\/\/your[-_]/i.test(value);
}

function publicUrl(env) {
  // Use only explicit configuration or Render's documented variable, never Host headers.
  const explicit = (env.APP_URL || '').trim();
  return placeholder(explicit) ? (env.RENDER_EXTERNAL_URL || '').trim() : explicit;
}

function validateProduction(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const errors = [];
  let provider;
  try { provider = emailProvider(env); } catch (error) { errors.push(error.message); }
  const emailKeys = provider === 'resend' ? ['RESEND_API_KEY', 'EMAIL_FROM'] : ['GMAIL_USER', 'GMAIL_APP_PASSWORD'];
  for (const key of ['SESSION_SECRET', 'MONGODB_URI', ...emailKeys]) {
    if (placeholder(env[key])) errors.push(`Set a real ${key} in the hosting environment.`);
  }
  if (!placeholder(env.SESSION_SECRET) && env.SESSION_SECRET.length < 32) {
    errors.push('SESSION_SECRET must contain at least 32 characters.');
  }
  const selected = publicUrl(env);
  if (placeholder(selected)) {
    errors.push('Set APP_URL to your public HTTPS website address. Render can supply RENDER_EXTERNAL_URL automatically.');
  } else {
    try {
      const url = new URL(selected);
      if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
          url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
        errors.push('APP_URL must be your public HTTPS origin, without login details, a path, query or fragment.');
      }
    } catch (_) { errors.push('APP_URL must be a valid public HTTPS website address.'); }
  }
  if (!env.DATABASE_URL && !(env.DB_HOST && env.DB_NAME && env.DB_USER && env.DB_PASS)) {
    errors.push('Set DATABASE_URL or DB_HOST, DB_NAME, DB_USER and DB_PASS for hosted PostgreSQL.');
  }
  if (errors.length) {
    const error = new Error('Production configuration needs attention:\n- ' + errors.join('\n- '));
    error.code = 'CONFIGURATION_ERROR';
    throw error;
  }
}

function configureProduction(env = process.env) {
  validateProduction(env);
  if (env.NODE_ENV === 'production') env.APP_URL = new URL(publicUrl(env)).origin;
}
module.exports = { validateProduction, configureProduction };
