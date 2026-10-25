const db = require('../config/db');
const { ObjectId } = require('mongodb');
const safe = (value, max) => typeof value === 'string' ? value.trim().slice(0,max) : '';
const audit = (t, actor, action, type, id, note) => t.none(`INSERT INTO audit_records(actor_id,action,target_type,target_id,note) VALUES($1,$2,$3,$4,$5)`, [actor,action,type,String(id),note]);

exports.reports = async (req, res, next) => {
  try {
    const reports = await db.any('SELECT * FROM reports WHERE reporter_id=$1 ORDER BY created_at DESC LIMIT 100', [req.session.user.id]);
    res.render('support/reports', { title:'Reports and complaints', reports, targetJob:safe(req.query.job,10), targetUser:safe(req.query.user,10) });
  } catch(error) { next(error); }
};
exports.report = async (req, res, next) => {
  try {
    const kind=safe(req.body.kind,20),subject=safe(req.body.subject,150),details=safe(req.body.details,3000);
    const jobId=/^\d+$/.test(req.body.jobId || '') ? Number(req.body.jobId) : null;
    const userId=/^\d+$/.test(req.body.userId || '') ? Number(req.body.userId) : null;
    if(!['job','user','complaint'].includes(kind)||!subject||details.length<10 || kind==='job'&&!jobId || kind==='user'&&!userId) {
      req.session.error='Choose a report type, subject and description of at least 10 characters.';
      return res.redirect('/reports');
    }
    if(jobId) {
      const job=await require('../models/Job').getById(jobId);
      const application=await db.oneOrNone('SELECT id FROM applications WHERE job_id=$1 AND student_id=$2',[jobId,req.session.user.id]);
      if(!job||!require('../config/workRules').canView(job,req.session.user,!!application)) return res.status(403).render('error',{message:'This job is not available to your account.'});
    }
    if(userId&&!await db.oneOrNone("SELECT id FROM users WHERE id=$1 AND account_status<>'deleted'",[userId])) return res.status(400).render('error',{message:'Choose an existing account.'});
    await db.none(`INSERT INTO reports(reporter_id,target_user_id,job_id,kind,subject,details) VALUES($1,$2,$3,$4,$5,$6)`,[req.session.user.id,userId,jobId,kind,subject,details]);
    req.session.success='Report received. An administrator can review it; updates will appear here.';
    res.redirect('/reports');
  } catch(error) { next(error); }
};
exports.resolve = async (req,res,next) => {
  try {
    const status=safe(req.body.status,20),note=safe(req.body.resolution,1500);
    if(!['under_review','resolved','dismissed'].includes(status)||!note) return res.status(400).render('error',{message:'Choose a valid status and explain the decision.'});
    await db.tx(async t=>{
      const report=await t.oneOrNone(`UPDATE reports SET status=$2,resolution=$3,updated_at=NOW() WHERE id=$1 RETURNING reporter_id`,[req.params.id,status,note]);
      if(!report)return;
      await audit(t,req.session.user.id,'report_'+status,'report',req.params.id,note);
      await t.none(`INSERT INTO notifications(user_id,category,message,href) VALUES($1,'report',$2,'/reports')`,[report.reporter_id,'Your report is '+status.replace('_',' ')+'.']);
    });
    res.redirect('/admin');
  } catch(error) { next(error); }
};
exports.userStatus = async (req,res,next) => {
  try {
    const status=safe(req.body.status,20),note=safe(req.body.reason,1500);
    if(!['active','suspended'].includes(status)||!note)return res.status(400).render('error',{message:'Choose a valid account status and provide a reason.'});
    await db.tx(async t=>{
      const user=await t.oneOrNone(`UPDATE users SET account_status=$2,session_version=session_version+1 WHERE id=$1 AND NOT is_admin AND account_status<>'deleted' RETURNING id`,[req.params.id,status]);
      if(user)await audit(t,req.session.user.id,'account_'+status,'user',user.id,note);
    });
    res.redirect('/admin');
  } catch(error) { next(error); }
};
exports.jobStatus = async (req,res,next) => {
  try {
    const note=safe(req.body.reason,1500);
    if(!['suspend','reactivate'].includes(req.body.action)||!note)return res.status(400).render('error',{message:'Choose a valid action and provide a reason.'});
    await db.tx(async t=>{
      const job=await t.oneOrNone('UPDATE jobs SET is_suspended=$2 WHERE id=$1 RETURNING id',[req.params.id,req.body.action==='suspend']);
      if(job)await audit(t,req.session.user.id,'job_'+req.body.action,'job',job.id,note);
    });
    res.redirect('/admin');
  } catch(error) { next(error); }
};
exports.review = async (req,res,next) => {
  try {
    const reason=safe(req.body.reason,1500);
    if(!ObjectId.isValid(req.params.id)||!['hide','restore'].includes(req.body.action)||!reason)return res.status(400).render('error',{message:'Choose a review action and provide a moderation reason.'});
    const result=await require('../config/mongo').getMongoDb().collection('ratings').findOneAndUpdate({_id:new ObjectId(req.params.id)},{$set:{hidden:req.body.action==='hide',moderationReason:reason,moderatedAt:new Date(),moderatedBy:req.session.user.id}},{returnDocument:'after'});
    if(result){
      await require('../models/Rating').refreshSummary(result.employeeId);
      await audit(db,req.session.user.id,'review_'+req.body.action,'rating',req.params.id,reason);
    }
    res.redirect('/admin');
  } catch(error) { next(error); }
};
exports.audit = audit;
