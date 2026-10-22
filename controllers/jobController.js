const { isOpen, canView, dateInput } = require('../config/workRules');
const db = require('../config/db');
const Job = require('../models/Job');
const User = require('../models/User');

exports.list = async (req, res, next) => {
  try { res.render('jobs/index', { title: 'Available Jobs', jobs: req.session.user && !req.session.user.isStudent && !req.session.user.isAdmin ? [] : await Job.getOpenJobs() }); }
  catch (error) { next(error); }
};

exports.show = async (req, res, next) => {
  try {
    const job = await Job.getById(req.params.id);
    if (!job) return res.status(404).render('error', { title: 'Job Not Found', message: 'Job not found.' });
    const application = req.session.user ? await db.oneOrNone('SELECT status FROM applications WHERE job_id=$1 AND student_id=$2',[job.id,req.session.user.id]) : null;
    if (!canView(job, req.session.user, !!application)) return res.status(403).render('error',{title:'Access denied',message:'This work is not available to your account.'});
    const availableStudents = job.urgency === 'urgent' && job.employer_id === req.session.user?.id
      ? await User.listAvailableStudents(job.start_at, job.end_at) : [];
    res.render('jobs/show', { title: job.title, job, availableStudents, application, applicationsOpen:isOpen(job) });
  } catch (error) { next(error); }
};

exports.showCreate = (req, res) => res.render('jobs/new', { title: 'Post a Job', draft:null });

exports.create = async (req, res, next) => {
  try {
    const data = {
      requirements: typeof req.body.requirements === 'string' ? req.body.requirements.trim().slice(0,1500) : '',
      title: typeof req.body.title === 'string' ? req.body.title.trim() : '', description: typeof req.body.description === 'string' ? req.body.description.trim() : '',
      workType: typeof req.body.workType === 'string' ? req.body.workType.trim() : '', location: typeof req.body.location === 'string' ? req.body.location.trim() : '',
      wageRate: Number(req.body.wageRate), wageUnit: req.body.wageUnit,
      workersNeeded: Number(req.body.workersNeeded), startAt: dateInput(req.body.startAt),
      endAt: dateInput(req.body.endAt), urgency: req.body.urgency,
      opensAt: dateInput(req.body.opensAt), closesAt: dateInput(req.body.closesAt), status: req.body.status === 'draft' ? 'draft' : 'open',
    };
    if (data.title.length>120 || data.description.length>2000 || data.location.length>150 || data.workType.length>60 || !data.opensAt || !data.closesAt || new Date(data.opensAt) >= new Date(data.closesAt) || new Date(data.closesAt) > new Date(data.startAt) || !Number.isFinite(data.wageRate) || !Number.isInteger(data.workersNeeded) || data.workersNeeded > 50 || !['hour','day','task'].includes(data.wageUnit) || !['normal','urgent'].includes(data.urgency) || !data.title || !data.description || !data.workType || !data.location ||
        data.wageRate <= 0 || data.workersNeeded < 1 || !data.startAt || !data.endAt ||
        new Date(data.endAt) <= new Date(data.startAt)) {
      req.session.error = 'Enter valid job details, wage, workers and working time.';
      return res.redirect('/jobs/new');
    }
    const job = req.params.id ? await Job.updateDraft(req.params.id,req.session.user.id,data) : await Job.createJob(req.session.user.id, data);
    if(!job) return res.status(403).render('error',{title:'Cannot edit',message:'Only your drafts can be edited.'});
    req.session.success = job.status === 'draft' ? 'Draft saved. Edit or publish it from this page.'
      : new Date(job.application_opens_at) > new Date()
        ? `Work published and scheduled. Employee calendars will show it when applications open on ${new Date(job.application_opens_at).toLocaleString('en-GB', {timeZone:'Asia/Thimphu'})} (Bhutan time).`
        : new Date(job.application_closes_at) <= new Date()
          ? 'Work saved, but its application deadline has passed. It is not available in employee calendars.'
          : 'Work published. It is now available in employee calendars.';
    res.redirect(`/jobs/${job.id}`);
  } catch (error) { next(error); }
};

exports.close = async (req, res, next) => {
  try {
    await Job.closeJob(req.params.id, req.session.user.id);
    req.session.success = 'Job closed.';
    res.redirect('/dashboard');
  } catch (error) { next(error); }
};

exports.publish = async (req,res,next) => { try { const job=await Job.publish(req.params.id,req.session.user.id); req.session[job?'success':'error']=job?'Work published.':'Only an unexpired draft can be published.'; res.redirect('/dashboard'); } catch(e){next(e);} };

exports.edit=async(req,res,next)=>{try{const draft=await Job.getById(req.params.id);if(!draft||draft.employer_id!==req.session.user.id||draft.status!=='draft')return res.status(403).render('error',{title:'Cannot edit',message:'Only your drafts can be edited.'});res.render('jobs/new',{title:'Edit draft',draft});}catch(e){next(e);}};
exports.cancel=async(req,res,next)=>{try{await db.tx(async t=>{const j=await t.oneOrNone("UPDATE jobs SET status='cancelled' WHERE id=$1 AND employer_id=$2 AND status IN ('draft','open','closed') RETURNING id",[req.params.id,req.session.user.id]);if(j)await t.none("UPDATE applications SET status='withdrawn',decided_at=NOW(),decision_note='Withdrawn because the employer cancelled this work.' WHERE job_id=$1 AND status='pending'",[j.id]);});res.redirect('/dashboard');}catch(e){next(e);}};
