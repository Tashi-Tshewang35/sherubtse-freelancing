const db = require('../config/db');

function createJob(employerId, data) {
  return db.one(
    `INSERT INTO jobs
      (employer_id, title, description, work_type, location, wage_rate,
       wage_unit, workers_needed, start_at, end_at, urgency, status, application_opens_at, application_closes_at, published_at, requirements)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,CASE WHEN $12 = 'open' THEN NOW() ELSE NULL END,$15)
     RETURNING *`,
    [
      employerId, data.title, data.description, data.workType, data.location,
      data.wageRate, data.wageUnit, data.workersNeeded, data.startAt, data.endAt,
      data.urgency, data.status, data.opensAt, data.closesAt, data.requirements || '',
    ]
  );
}

function getOpenJobs() {
  return db.any(
    `SELECT j.*, u.account_status AS employer_account_status, u.employer_status, u.is_verified AS employer_verified, COALESCE(ep.business_name,u.name) AS employer_name,
            (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicant_count
     FROM jobs j JOIN users u ON u.id = j.employer_id LEFT JOIN employer_profiles ep ON ep.user_id=u.id
     WHERE NOT j.is_suspended AND u.account_status='active' AND j.status = 'open' AND j.published_at IS NOT NULL AND j.application_opens_at <= NOW() AND j.application_closes_at > NOW() AND u.employer_status = 'approved' AND u.is_verified = true
     ORDER BY CASE WHEN j.urgency = 'urgent' THEN 0 ELSE 1 END, j.start_at`
  );
}

function getById(id) {
  return db.oneOrNone(
    `SELECT j.*, u.account_status AS employer_account_status, u.employer_status, u.is_verified AS employer_verified, COALESCE(ep.business_name,u.name) AS employer_name,
            (SELECT COUNT(*) FROM applications a WHERE a.job_id = j.id) AS applicant_count
     FROM jobs j JOIN users u ON u.id = j.employer_id LEFT JOIN employer_profiles ep ON ep.user_id=u.id
     WHERE j.id = $1`,
    [id]
  );
}

function getByEmployer(employerId) {
  return db.any(
    `SELECT j.*, COUNT(a.id)::int AS applicant_count, COUNT(a.id) FILTER(WHERE a.status='accepted')::int AS accepted_count, COUNT(a.id) FILTER(WHERE a.status='in_progress')::int AS in_progress_count, COUNT(a.id) FILTER(WHERE a.status='completed')::int AS completed_count, COUNT(a.id) FILTER(WHERE a.status='rejected')::int AS rejected_count
     FROM jobs j LEFT JOIN applications a ON a.job_id = j.id
     WHERE j.employer_id = $1
     GROUP BY j.id ORDER BY j.created_at DESC`,
    [employerId]
  );
}

function closeJob(id, employerId) {
  return db.oneOrNone(
    `UPDATE jobs SET status = 'closed'
     WHERE id = $1 AND employer_id = $2 RETURNING *`,
    [id, employerId]
  );
}

function publish(id, employerId) {
 return db.oneOrNone(`UPDATE jobs SET status='open',published_at=NOW() WHERE id=$1 AND employer_id=$2 AND status='draft' AND application_closes_at>NOW() RETURNING *`,[id,employerId]);
}
async function updateDraft(id, employerId, data) {
 return db.tx(async t=>{
  const job=await t.oneOrNone('SELECT id,status FROM jobs WHERE id=$1 AND employer_id=$2 FOR UPDATE',[id,employerId]);
  if(!job || !['draft','open'].includes(job.status))return null;
  if(job.status==='open' && (data.status!=='open' || await t.oneOrNone('SELECT id FROM applications WHERE job_id=$1 LIMIT 1',[id])))return null;
  return t.oneOrNone(`UPDATE jobs SET requirements=$16,title=$3,description=$4,work_type=$5,location=$6,wage_rate=$7,wage_unit=$8,workers_needed=$9,start_at=$10,end_at=$11,urgency=$12,application_opens_at=$13,application_closes_at=$14,status=$15,published_at=CASE WHEN $15='open' THEN COALESCE(published_at,NOW()) ELSE NULL END WHERE id=$1 AND employer_id=$2 RETURNING *`,[id,employerId,data.title,data.description,data.workType,data.location,data.wageRate,data.wageUnit,data.workersNeeded,data.startAt,data.endAt,data.urgency,data.opensAt,data.closesAt,data.status,data.requirements||'']);
 });
}

module.exports = { updateDraft,publish, createJob, getOpenJobs, getById, getByEmployer, closeJob };
