const Job = require('../models/Job');
const Application = require('../models/Application');
const Rating = require('../models/Rating');
const User = require('../models/User');

exports.home = async (req, res, next) => {
  try {
    const jobs = req.session.user && !req.session.user.isStudent && !req.session.user.isAdmin ? [] : await Job.getOpenJobs();
    res.render('index', { title: 'Sherubtse Freelancing', jobs: jobs.slice(0, 6) });
  } catch (error) { next(error); }
};

exports.dashboard = async (req, res, next) => {
  try {
    const user = await require('../models/Profile').get(req.session.user.id);
    if (!user || !user.is_verified) {
      return req.session.destroy(() => res.redirect('/login'));
    }
    req.session.user = {
      id: user.id, name: user.name, email: user.email,
      isStudent: user.is_student, isEmployer: user.is_employer,
      employerStatus: user.employer_status, isAdmin: user.is_admin,
    };
    res.locals.user = req.session.user;

    const studentApplications = user.is_student ? await Application.getStudentApplications(user.id) : [];
    const employerJobs = user.is_employer ? await Job.getByEmployer(user.id) : [];
    const ratings = user.is_student ? await Rating.getEmployeeRatings(user.id) : [];

    res.render('dashboards/main', {
      notifications: await require('../models/Notification').list(user.id),
      title: 'Dashboard', profile: user, studentApplications, employerJobs, ratings,
    });
  } catch (error) { next(error); }
};

exports.updateAvailability = async (req, res, next) => {
  try {
    const status = req.body.status === 'inactive' ? 'inactive' : 'active';
    await User.updateAvailability(req.session.user.id, status);
    req.session.success = `Availability changed to ${status}.`;
    res.redirect('/dashboard');
  } catch (error) { next(error); }
};
