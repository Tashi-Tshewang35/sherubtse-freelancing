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
      employerStatus: user.employer_status, isAdmin: user.is_admin, sessionVersion: req.session.user.sessionVersion || 0,
    };
    res.locals.user = req.session.user;

    const studentApplications = user.is_student ? await Application.getStudentApplications(user.id) : [];
    const employerJobs = user.is_employer ? await Job.getByEmployer(user.id) : [];
    const ratings = user.is_student ? await Rating.getEmployeeRatings(user.id) : [];

    const openJobs=user.is_student ? await Job.getOpenJobs() : [];
    const skills=user.skills.map(s=>s.name.toLowerCase());
    const recommendations=openJobs.filter(j=>skills.some(s=>[j.work_type,j.requirements,j.description].join(' ').toLowerCase().includes(s))).slice(0,3);
    const deadlines=[...openJobs].sort((a,b)=>new Date(a.application_closes_at)-new Date(b.application_closes_at)).slice(0,4);
    const mode=user.is_student && user.is_employer ? (req.query.mode==='employer'?'employer':'student') : user.is_student?'student':'employer';
    const visibleProfile={...user,is_student:user.is_student && mode==='student',is_employer:user.is_employer && mode==='employer'};
    const ratedIds=new Set(ratings.map(r=>Number(r.applicationId)));
    studentApplications.forEach(a=>{a.rated=ratedIds.has(a.id);});
    res.render('dashboards/main', {
      mode,dualRole:user.is_student && user.is_employer,recommendations,deadlines,
      notifications: await require('../models/Notification').list(user.id),
      title: 'Dashboard', profile: visibleProfile, studentApplications, employerJobs, ratings,
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
