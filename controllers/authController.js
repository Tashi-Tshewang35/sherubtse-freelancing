const { isValidStudentEmail, isValidPassword } = require('../utils/validators');
const User = require('../models/User');
const { sendVerificationEmail } = require('../config/mailer');
const { createVerification } = require('../config/verification');

function sessionUser(user) {
  return { id: user.id, name: user.name, email: user.email, isStudent: user.is_student,
    isEmployer: user.is_employer, employerStatus: user.employer_status, isAdmin: user.is_admin };
}
function fail(req, res, error, destination) {
  console.error('[Authentication] Request failed:', { code: error.code || 'UNKNOWN' });
  req.session.error = 'The service is temporarily unavailable. Please try again shortly.';
  return res.redirect(destination);
}
async function deliver(req, res, user, verification) {
  try {
    await sendVerificationEmail(user.email, verification.token);
    return res.render('auth/check-email', { title: 'Check Your Email', email: user.email });
  } catch (error) {
    await User.allowVerificationRetry(user.id, verification.hash);
    req.session.error = 'Your account is saved, but we could not send the verification email. Please use Resend verification email to try again.';
    return res.redirect('/resend-verification');
  }
}
async function resend(req, res, user) {
  const verification = createVerification();
  const updated = await User.renewVerification(user.id, verification.hash, verification.expiresAt);
  if (!updated) {
    req.session.error = 'Please wait one minute before requesting another email, or log in if already verified.';
    return res.redirect('/resend-verification');
  }
  return deliver(req, res, updated, verification);
}
exports.showSignup = (req, res) => res.render('auth/signup', { title: 'Create Account' });
exports.signup = async (req, res) => {
  try {
    const { name, email, password, accountType } = req.body;
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 100 ||
        typeof email !== 'string' || email.trim().length > 150 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof password !== 'string' || !['student', 'employee', 'employer', 'both'].includes(accountType)) {
      req.session.error = 'Enter your name, a valid email address, password and account type.';
      return res.redirect('/signup');
    }
    if (!isValidPassword(password)) {
      req.session.error = 'Password must have at least 6 characters and fit within 72 bytes.';
      return res.redirect('/signup');
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (['student', 'employee', 'both'].includes(accountType) &&
        !isValidStudentEmail(normalizedEmail)) {
      req.session.error = 'Student and employee accounts require an email such as 07240057.sherubtse@rub.edu.bt';
      return res.redirect('/signup');
    }
    const existing = await User.findByEmail(normalizedEmail);
    if (existing) {
      if (!existing.is_verified && await User.verifyPassword(password, existing.password_hash)) {
        return await resend(req, res, existing);
      }
      req.session.error = 'This email is registered. Log in or use Resend verification email.';
      return res.redirect('/signup');
    }
    const verification = createVerification();
    const user = await User.createUser({ name, email: normalizedEmail, password, accountType,
      verificationToken: verification.hash, verificationExpiresAt: verification.expiresAt });
    return await deliver(req, res, user, verification);
  } catch (error) {
    if (error.code === '23505') {
      req.session.error = 'This email is registered. Log in or resend your verification email.';
      return res.redirect('/signup');
    }
    return fail(req, res, error, '/signup');
  }
};
exports.showResend = (req, res) => res.render('auth/resend-verification', { title: 'Resend Verification Email' });
exports.verifyPastedLink = (req, res) => {
  const value = typeof req.body.verificationLink === 'string' ? req.body.verificationLink.trim() : '';
  let token = /^[a-f0-9]{64}$/.test(value) ? value : null;
  if (!token) {
    try {
      const url = new URL(value);
      if (['http:', 'https:'].includes(url.protocol)) {
        token = url.pathname.match(/^\/verify\/([a-f0-9]{64})\/?$/)?.[1];
      }
    } catch (_) { /* Invalid links receive the message below. */ }
  }
  if (!token) {
    req.session.error = 'Paste the complete verification link from your email.';
    return res.redirect('/resend-verification');
  }
  return res.redirect('/verify/' + token);
};
exports.resendVerification = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      req.session.error = 'Enter the email and password you used to register.';
      return res.redirect('/resend-verification');
    }
    const user = await User.findByEmail(email);
    if (!user || !await User.verifyPassword(password, user.password_hash)) {
      req.session.error = 'Incorrect email or password.';
      return res.redirect('/resend-verification');
    }
    if (user.is_verified) {
      req.session.success = 'Your email is already verified. You can log in.';
      return res.redirect('/login');
    }
    return await resend(req, res, user);
  } catch (error) { return fail(req, res, error, '/resend-verification'); }
};
exports.verifyEmail = async (req, res) => {
  try {
    const user = await User.markVerified(req.params.token);
    if (!user) {
      req.session.error = 'This verification link is invalid, expired or already used. Request a new email, or log in if already verified.';
      return res.redirect('/resend-verification');
    }
    return res.render('auth/verified', { title: 'Email Verified', verifiedUser: user });
  } catch (error) { return fail(req, res, error, '/resend-verification'); }
};
exports.showLogin = (req, res) => res.render('auth/login', { title: 'Log In' });
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== 'string' || typeof password !== 'string') {
      req.session.error = 'Enter your email and password.';
      return res.redirect('/login');
    }
    const user = await User.findByEmail(email);
    if (!user || !await User.verifyPassword(password, user.password_hash)) {
      req.session.error = 'Incorrect email or password.';
      return res.redirect('/login');
    }
    if (!user.is_verified) {
      req.session.error = 'Verify your email before logging in. You can request a new verification email below.';
      return res.redirect('/login');
    }
    await new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    req.session.user = sessionUser(user);
    await new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    return res.redirect('/dashboard');
  } catch (error) { return fail(req, res, error, '/login'); }
};
exports.logout = (req, res) => req.session.destroy(() => res.redirect('/'));
