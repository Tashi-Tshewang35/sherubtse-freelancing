const crypto = require('crypto');

const TOKEN_LIFETIME_MS = 24 * 60 * 60 * 1000;
function createVerification() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token), expiresAt: new Date(Date.now() + TOKEN_LIFETIME_MS) };
}
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
module.exports = { createVerification, hashToken };
