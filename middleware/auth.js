const User = require('../models/User');
async function refreshUser(req, res, next) {
 try {
  if (req.session.user) {
   const u = await User.findById(req.session.user.id);
   req.session.user = u && u.is_verified ? { id:u.id, name:u.name, email:u.email, isStudent:u.is_student, isEmployer:u.is_employer, employerStatus:u.employer_status, isAdmin:u.is_admin } : null;
   res.locals.user = req.session.user;
  }
  next();
 } catch(error) { next(error); }
}
function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireStudent(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (!req.session.user.isStudent) return res.status(403).render('error', { title: 'Access Denied', message: 'Verified students only.' });
  next();
}

function requireApprovedEmployer(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (!req.session.user.isEmployer || req.session.user.employerStatus !== 'approved') {
    return res.status(403).render('error', { title: 'Access Denied', message: 'Approved employers only.' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (!req.session.user.isAdmin) return res.status(403).render('error', { title: 'Access Denied', message: 'Administrator access required.' });
  next();
}

function requireAuthApi(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Authentication required.' });
  next();
}

module.exports = { refreshUser, requireAuth, requireStudent, requireApprovedEmployer, requireAdmin, requireAuthApi };
