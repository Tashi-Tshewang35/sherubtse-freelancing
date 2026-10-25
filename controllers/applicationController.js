const Application = require('../models/Application');
const Job = require('../models/Job');
exports.review = async (req, res, next) => {
  try {
    await require('../config/db').none(`UPDATE applications a SET status='under_review' FROM jobs j WHERE a.job_id=j.id AND a.id=$1 AND j.employer_id=$2 AND a.status='pending'`, [req.params.id, req.session.user.id]);
    res.redirect('/dashboard');
  } catch (error) { next(error); }
};

exports.apply = async (req, res, next) => {
  try {
    const job = await Job.getById(req.params.jobId);
    if (!job || !require('../config/workRules').isOpen(job)) {
      req.session.error = 'This job is not available.';
      return res.redirect('/jobs');
    }
    if (job.employer_id === req.session.user.id) {
      req.session.error = 'You cannot apply for your own job post.';
      return res.redirect(`/jobs/${job.id}`);
    }
    const application = await Application.apply(job.id, req.session.user.id, typeof req.body.coverNote === 'string' ? req.body.coverNote.trim().slice(0,500) : '');
    req.session.success = application ? 'Application submitted.' : 'You already applied, or applications are no longer open.';
    res.redirect('/dashboard');
  } catch (error) { next(error); }
};

exports.applicants = async (req, res, next) => {
  try {
    const job = await Job.getById(req.params.jobId);
    if (!job || job.employer_id !== req.session.user.id) {
      return res.status(403).render('error', { title: 'Access Denied', message: 'You do not own this job.' });
    }
    const applicants = await Application.getJobApplicants(job.id, req.session.user.id);
    res.render('jobs/applicants', { title: 'Applicants', job, applicants });
  } catch (error) { next(error); }
};

exports.accept = async (req, res, next) => {
  try {
    const result = await Application.accept(req.params.id, req.session.user.id);
    req.session.success = result ? 'Student recruited successfully.' : 'Application cannot be accepted.';
    res.redirect('/dashboard');
  } catch (error) {
    req.session.error = error.code ? 'Recruitment could not be saved. Please try again.' : error.message;
    res.redirect('/dashboard');
  }
};

exports.reject = async (req, res, next) => {
  try {
    await Application.reject(req.params.id, req.session.user.id, typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0,500) : '');
    req.session.success = 'Application rejected.';
    res.redirect('/dashboard');
  } catch (error) { next(error); }
};

exports.directRecruit = async (req, res) => {
  try {
    await Application.directRecruit(req.params.jobId, req.body.studentId, req.session.user.id);
    req.session.success = 'Invitation sent. The student must confirm before being recruited.';
  } catch (error) { req.session.error = error.code ? 'Recruitment could not be saved. Please try again.' : error.message; }
  res.redirect(`/jobs/${req.params.jobId}`);
};

exports.complete = async (req, res, next) => {
  try {
    const completed = await Application.markCompleted(req.params.id, req.session.user.id);
    req.session.success = completed ? 'Work marked as completed. You may now rate the student.' : 'Unable to complete this work.';
    res.redirect('/dashboard');
  } catch (error) { next(error); }
};

exports.withdraw = async(req,res,next)=>{try{await require('../config/db').none("UPDATE applications SET status='withdrawn',decided_at=NOW(),decision_note='You withdrew this application.' WHERE id=$1 AND student_id=$2 AND status IN ('pending','under_review')",[req.params.id,req.session.user.id]);res.redirect('/profile');}catch(e){next(e);}};

for (const action of ['confirm', 'decline', 'start']) {
  exports[action] = async (req, res, next) => {
    try {
      const result = await Application[action](req.params.id, req.session.user.id);
      req.session[result ? 'success' : 'error'] = result ? 'Work progress updated.' : 'This action is no longer available.';
      res.redirect('/dashboard');
    } catch (error) {
      if (error.code) return next(error);
      req.session.error = error.message;
      res.redirect('/dashboard');
    }
  };
}
