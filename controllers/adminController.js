const User = require('../models/User');

exports.dashboard = async (req, res, next) => {
  try {
    const db=require('../config/db');
    const filters={verified:['true','false'].includes(req.query.verified)?req.query.verified:'',q:typeof req.query.q==='string'?req.query.q.trim():'',role:req.query.role||'',approval:req.query.approval||'',status:req.query.status||''};
    const accounts=await db.any(`SELECT u.id,u.name,u.email,u.is_student,u.is_employer,u.is_admin,u.is_verified,u.employer_status,sp.student_number
    FROM users u LEFT JOIN student_profiles sp ON sp.user_id=u.id
    WHERE ($1='' OR u.name ILIKE $2 OR u.email ILIKE $2 OR sp.student_number ILIKE $2)
    AND ($3='' OR ($3='student' AND u.is_student) OR ($3='employer' AND u.is_employer) OR ($3='both' AND u.is_student AND u.is_employer) OR ($3='admin' AND u.is_admin))
    AND ($4='' OR u.employer_status=$4) AND ($5='' OR u.is_verified=NULLIF($5,'')::boolean) ORDER BY u.name`,[filters.q,'%'+filters.q+'%',filters.role,filters.approval,filters.verified]);
    const applications=await db.any(`SELECT a.*,j.title,u.name,u.email,sp.student_number,e.name AS employer_name FROM applications a JOIN jobs j ON j.id=a.job_id JOIN users u ON u.id=a.student_id JOIN users e ON e.id=j.employer_id LEFT JOIN student_profiles sp ON sp.user_id=u.id
    WHERE ($1='' OR a.status=$1) AND ($2='' OR u.name ILIKE $3 OR u.email ILIKE $3 OR sp.student_number ILIKE $3)
    AND ($4='' OR ($4='student' AND u.is_student) OR ($4='employer' AND u.is_employer) OR ($4='both' AND u.is_student AND u.is_employer) OR ($4='admin' AND u.is_admin))
    AND ($5='' OR u.employer_status=$5) AND ($6='' OR u.is_verified=NULLIF($6,'')::boolean) ORDER BY a.created_at DESC`,[filters.status,filters.q,'%'+filters.q+'%',filters.role,filters.approval,filters.verified]);
    res.render('dashboards/admin', { accounts,applications,filters,
      title: 'Admin Dashboard', pendingEmployers: await User.listPendingEmployers(),
    });
  } catch (error) { next(error); }
};

exports.approveEmployer = async (req, res, next) => {
  try {
    const approved = await User.approveEmployer(req.params.userId);
    if (approved) await require('../models/Notification').add(approved.id, 'approval', 'Your employer access is approved. You can now post work.', '/jobs/new');
    req.session.success = 'Employer approved.';
    res.redirect('/admin');
  } catch (error) { next(error); }
};

exports.rejectEmployer = async (req, res, next) => {
  try {
    const rejected = await User.rejectEmployer(req.params.userId);
    if (rejected) await require('../models/Notification').add(rejected.id, 'approval', 'Employer access rejected. ' + (typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0,500) : ''), '/profile');
    req.session.success = 'Employer request rejected.';
    res.redirect('/admin');
  } catch (error) { next(error); }
};
