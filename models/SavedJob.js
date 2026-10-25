const db = require('../config/db');
exports.save = (userId, jobId) => db.none(`INSERT INTO saved_jobs(user_id,job_id)
  SELECT $1,j.id FROM jobs j JOIN users e ON e.id=j.employer_id WHERE j.id=$2 AND j.status='open' AND NOT j.is_suspended
  AND j.published_at IS NOT NULL AND e.account_status='active' AND e.employer_status='approved'
  ON CONFLICT DO NOTHING`, [userId, jobId]);
exports.remove = (userId, jobId) => db.none('DELETE FROM saved_jobs WHERE user_id=$1 AND job_id=$2', [userId, jobId]);
exports.list = userId => db.any(`SELECT j.*,COALESCE(ep.business_name,e.name) AS employer_name,e.employer_status,e.is_verified AS employer_verified
  FROM saved_jobs s JOIN jobs j ON j.id=s.job_id JOIN users e ON e.id=j.employer_id
  LEFT JOIN employer_profiles ep ON ep.user_id=e.id WHERE s.user_id=$1 ORDER BY s.created_at DESC`, [userId]);
