const crypto = require('crypto');

function csrf(req, res, next) {
  req.session.csrfToken ||= crypto.randomBytes(32).toString('hex');
  res.locals.csrfToken = req.session.csrfToken;
  res.set('Cache-Control', 'no-store');
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const token = req.get('X-CSRF-Token') || req.body?._csrf;
  const expected = req.session.csrfToken;
  if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) && token.length === expected.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return next();
  if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'Session validation failed. Refresh the page and try again.' });
  return res.status(403).render('error', { title: 'Refresh required', message: 'Session validation failed. Refresh the page and try again.' });
}

// Fixed-window limits use atomic PostgreSQL-free Mongo updates, shared across app instances.
// Fail closed if the store is unavailable; never fall back to unlimited requests.
function rateLimit(name, maximum, windowMs = 15 * 60 * 1000) {
  return async (req, res, next) => {
    try {
      const bucket = Math.floor(Date.now() / windowMs);
      const key = crypto.createHash('sha256').update(`${name}:${req.ip}:${bucket}`).digest('hex');
      const entry = await require('../config/mongo').getMongoDb().collection('rate_limits').findOneAndUpdate(
        { _id: key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 1) * windowMs) } },
        { upsert: true, returnDocument: 'after' });
      if (entry.count <= maximum) return next();
      res.set('Retry-After', String(Math.ceil(((bucket + 1) * windowMs - Date.now()) / 1000)));
      return res.status(429).render('error', { title: 'Please wait', message: 'Too many attempts. Please wait before trying again.' });
    } catch (error) { next(error); }
  };
}
module.exports = { csrf, rateLimit };
