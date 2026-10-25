const Account = require('../models/Account');
const { isValidPassword } = require('../utils/validators');
const { createVerification } = require('../config/verification');
exports.forgotPage = (req, res) => res.render('auth/forgot-password', { title: 'Forgot password' });
exports.forgot = async (req, res, next) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 150) : '';
    const token = createVerification();
    const user = await Account.requestReset(email, token.hash, new Date(Date.now() + 30 * 60 * 1000));
    if (user) {
      try { await require('../config/mailer').sendPasswordResetEmail(user.email, token.token); }
      catch (_) { /* Same response for absent accounts and failed delivery. No tokens logged. */ }
    }
    req.session.success = 'If an eligible account matches that address, a reset link will arrive shortly. It expires in 30 minutes.';
    res.redirect('/forgot-password');
  } catch (error) { next(error); }
};
exports.resetPage = async (req, res, next) => {
  try {
    res.set('Referrer-Policy', 'no-referrer');
    if (!await Account.validReset(req.params.token)) return res.status(400).render('error', { title: 'Reset link unavailable', message: 'This reset link is invalid or expired. Request another from Forgot password.' });
    res.render('auth/reset-password', { title: 'Reset password', token: req.params.token });
  } catch (error) { next(error); }
};
exports.reset = async (req, res, next) => {
  try {
    if (!isValidPassword(req.body.password) || req.body.password !== req.body.confirmPassword) {
      req.session.error = 'Use at least 8 characters (at most 72 bytes) and matching passwords.';
      return res.redirect('/reset-password/' + encodeURIComponent(req.params.token));
    }
    const user = await Account.reset(req.params.token, req.body.password);
    req.session[user ? 'success' : 'error'] = user ? 'Password reset. Please log in. Previous sessions have been signed out.' : 'This reset link is invalid or expired.';
    req.session.user = null;
    res.redirect('/login');
  } catch (error) { next(error); }
};
exports.change = async (req, res, next) => {
  try {
    if (typeof req.body.currentPassword !== 'string' || !isValidPassword(req.body.password) || req.body.password !== req.body.confirmPassword) {
      req.session.error = 'Enter your current password and matching new passwords of at least 8 characters.';
      return res.redirect('/profile');
    }
    const changed = await Account.changePassword(req.session.user.id, req.body.currentPassword, req.body.password);
    if (changed) req.session.user.sessionVersion = changed.session_version;
    req.session[changed ? 'success' : 'error'] = changed ? 'Password changed. Other sessions have been signed out.' : 'Unable to change password. Check your current password.';
    res.redirect('/profile');
  } catch (error) { next(error); }
};
exports.close = async (req, res, next) => {
  try {
    const remove = req.body.action === 'delete';
    if (!['delete', 'deactivate'].includes(req.body.action) || req.body.confirmation !== (remove ? 'DELETE' : 'DEACTIVATE') || typeof req.body.currentPassword !== 'string') {
      req.session.error = 'Enter your current password and the exact confirmation word.';
      return res.redirect('/profile');
    }
    if (!await Account.close(req.session.user.id, req.body.currentPassword, remove)) {
      req.session.error = 'Unable to close this account. Check your password and finish or cancel active work first. Administrators cannot close their own account.';
      return res.redirect('/profile');
    }
    req.session.destroy(() => res.redirect('/login'));
  } catch (error) { next(error); }
};
