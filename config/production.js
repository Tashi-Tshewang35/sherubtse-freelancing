function validateProduction(env = process.env) {
  if (env.NODE_ENV !== 'production') return;
  for (const key of ['SESSION_SECRET', 'APP_URL', 'MONGODB_URI', 'GMAIL_USER', 'GMAIL_APP_PASSWORD']) {
    if (!env[key] || /^(your_|replace-|development-)/.test(env[key])) {
      throw new Error(`Set a real ${key} environment variable before production startup.`);
    }
  }
  if (env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters in production.');
  const url = new URL(env.APP_URL);
  if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password) {
    throw new Error('APP_URL must be your public HTTPS address in production.');
  }
  if (!env.DATABASE_URL && !(env.DB_HOST && env.DB_NAME && env.DB_USER && env.DB_PASS)) {
    throw new Error('Set DATABASE_URL or all PostgreSQL connection settings in production.');
  }
}
module.exports = { validateProduction };
