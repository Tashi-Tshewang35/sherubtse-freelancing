const User = require('../models/User');

exports.dashboard = async (req, res, next) => {
  try {
    const db=require('../config/db');
    const value=key=>typeof req.query[key]==='string'?req.query[key].trim().slice(0,200):'';
    const filters={verified:['true','false'].includes(req.query.verified)?req.query.verified:'',q:value('q'),role:value('role'),approval:value('approval'),status:value('status')};
    const page=Math.min(10000,Math.max(1,parseInt(req.query.page,10)||1));
    const accounts=await db.any(`SELECT COUNT(*) OVER() AS total_count,u.account_status,u.id,u.name,u.email,u.is_student,u.is_employer,u.is_admin,u.is_verified,u.employer_status,sp.student_number
    FROM users u LEFT JOIN student_profiles sp ON sp.user_id=u.id
    WHERE ($1='' OR u.name ILIKE $2 OR u.email ILIKE $2 OR sp.student_number ILIKE $2)
    AND ($3='' OR ($3='student' AND u.is_student AND NOT u.is_employer) OR ($3='employer' AND u.is_employer AND NOT u.is_student) OR ($3='both' AND u.is_student AND u.is_employer) OR ($3='admin' AND u.is_admin))
    AND ($4='' OR u.employer_status=$4) AND ($5='' OR u.is_verified=NULLIF($5,'')::boolean) ORDER BY u.name LIMIT 25 OFFSET $6`,[filters.q,'%'+filters.q+'%',filters.role,filters.approval,filters.verified,(page-1)*25]);
    const applications=await db.any(`SELECT COUNT(*) OVER() AS total_count,a.*,j.title,u.name,u.email,sp.student_number,e.name AS employer_name FROM applications a JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=a.student_id JOIN users e ON e.id=j.employer_id LEFT JOIN student_profiles sp ON sp.user_id=u.id
    WHERE ($1='' OR a.status=$1) AND ($2='' OR u.name ILIKE $3 OR u.email ILIKE $3 OR sp.student_number ILIKE $3)
    AND ($4='' OR ($4='student' AND u.is_student) OR ($4='employer' AND u.is_employer) OR ($4='both' AND u.is_student AND u.is_employer) OR ($4='admin' AND u.is_admin))
    AND ($5='' OR u.employer_status=$5) AND ($6='' OR u.is_verified=NULLIF($6,'')::boolean) ORDER BY a.created_at DESC LIMIT 25 OFFSET $7`,[filters.status,filters.q,'%'+filters.q+'%',filters.role,filters.approval,filters.verified,(page-1)*25]);
    const reports=await db.any('SELECT * FROM reports ORDER BY created_at DESC LIMIT 25 OFFSET $1',[(page-1)*25]);
    const moderationJobs=await db.any('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 25 OFFSET $1',[(page-1)*25]);
    const moderationRatings=await require('../config/mongo').getMongoDb().collection('ratings').find({}).sort({createdAt:-1}).skip((page-1)*25).limit(25).toArray();
    const auditRecords=await db.any('SELECT * FROM audit_records ORDER BY created_at DESC LIMIT 25 OFFSET $1',[(page-1)*25]);
    const applicationHistory=await db.any('SELECT * FROM application_status_history ORDER BY changed_at DESC LIMIT 25 OFFSET $1',[(page-1)*25]);
    res.render('dashboards/admin', { accounts,applications,filters,page,reports,moderationJobs,moderationRatings,auditRecords,applicationHistory,
      hasNext: accounts.length===25 || applications.length===25 || reports.length===25 || moderationJobs.length===25 || moderationRatings.length===25 || auditRecords.length===25 || applicationHistory.length===25,
      title: 'Admin Dashboard', pendingEmployers: await User.listPendingEmployers(),
    });
  } catch (error) { next(error); }
};

exports.approveEmployer = async (req, res, next) => {
  try {
    const approved = await User.approveEmployer(req.params.userId);
    if (approved) await require('./trustController').audit(require('../config/db'),req.session.user.id,'employer_approved','user',approved.id,'Employer approved.');
    if (approved) await require('../models/Notification').add(approved.id, 'approval', 'Your employer access is approved. You can now post work.', '/jobs/new');
    req.session.success = 'Employer approved.';
    res.redirect('/admin');
  } catch (error) { next(error); }
};

exports.rejectEmployer = async (req, res, next) => {
  try {
    const rejected = await User.rejectEmployer(req.params.userId);
    if (rejected) await require('./trustController').audit(require('../config/db'),req.session.user.id,'employer_rejected','user',rejected.id,typeof req.body.reason==='string'?req.body.reason.slice(0,1500):'');
    if (rejected) await require('../models/Notification').add(rejected.id, 'approval', 'Employer access rejected. ' + (typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0,500) : ''), '/profile');
    req.session.success = 'Employer request rejected.';
    res.redirect('/admin');
  } catch (error) { next(error); }
};
