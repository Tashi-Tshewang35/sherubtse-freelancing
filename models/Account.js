const bcrypt = require('bcrypt');
const db = require('../config/db');
const { hashToken } = require('../config/verification');
const tokenValid = token => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);

exports.requestReset = (email, hash, expires) => db.oneOrNone(`UPDATE users SET reset_token_hash=$2,reset_expires_at=$3
  WHERE email=$1 AND is_verified AND account_status='active' RETURNING id,email`, [email, hash, expires]);
exports.validReset = token => tokenValid(token) ? db.oneOrNone(`SELECT id FROM users WHERE reset_token_hash=$1 AND reset_expires_at>NOW() AND account_status='active'`, [hashToken(token)]) : Promise.resolve(null);
exports.reset = async (token, password) => {
  if (!tokenValid(token)) return null;
  const hash = await bcrypt.hash(password, 12);
  return db.oneOrNone(`UPDATE users SET password_hash=$2,reset_token_hash=NULL,reset_expires_at=NULL,session_version=session_version+1
    WHERE reset_token_hash=$1 AND reset_expires_at>NOW() AND account_status='active' RETURNING id`, [hashToken(token), hash]);
};
exports.changePassword = async (id, current, password) => {
  const hash = await bcrypt.hash(password, 12);
  return db.tx(async t => {
    const user = await t.oneOrNone('SELECT password_hash FROM users WHERE id=$1 AND account_status=\'active\' FOR UPDATE', [id]);
    if (!user || !await bcrypt.compare(current, user.password_hash)) return null;
    return t.one(`UPDATE users SET password_hash=$2,session_version=session_version+1,reset_token_hash=NULL,reset_expires_at=NULL WHERE id=$1 RETURNING session_version`, [id, hash]);
  });
};
exports.close = (id, password, remove) => db.tx(async t => {
  const user = await t.oneOrNone('SELECT * FROM users WHERE id=$1 FOR UPDATE', [id]);
  if (!user || user.is_admin || !await bcrypt.compare(password, user.password_hash)) return false;
  await t.any('SELECT id FROM jobs WHERE employer_id=$1 ORDER BY id FOR UPDATE', [id]);
  const active = await t.oneOrNone(`SELECT a.id FROM applications a JOIN jobs j ON j.id=a.job_id
    WHERE (a.student_id=$1 OR j.employer_id=$1) AND a.status IN ('accepted','in_progress') LIMIT 1`, [id]);
  if (active) return false;
  await t.none("UPDATE jobs SET status='cancelled' WHERE employer_id=$1 AND status IN ('open','draft','closed')", [id]);
  await t.none(`UPDATE applications SET status='withdrawn',decided_at=NOW(),decision_note='Account closed.'
    WHERE (student_id=$1 OR job_id IN (SELECT id FROM jobs WHERE employer_id=$1)) AND status IN ('pending','under_review','invited')`, [id]);
  await t.none(`UPDATE users SET account_status=$2,session_version=session_version+1,reset_token_hash=NULL,reset_expires_at=NULL,verification_token=NULL WHERE id=$1`, [id, remove ? 'deleted' : 'deactivated']);
  if (remove) {
    // Anonymize identity while preserving recruitment and dispute references.
    await t.none(`UPDATE users SET name='Deleted account',email=$2,password_hash='',is_student=false,is_employer=false,employer_status='not_requested',is_verified=false WHERE id=$1`, [id, `deleted-${id}@deleted.invalid`]);
    await t.none('DELETE FROM student_profiles WHERE user_id=$1; DELETE FROM employer_profiles WHERE user_id=$1; DELETE FROM user_skills WHERE user_id=$1; DELETE FROM calendar_tasks WHERE user_id=$1; DELETE FROM saved_jobs WHERE user_id=$1; DELETE FROM notifications WHERE user_id=$1', [id]);
  }
  await t.none(`INSERT INTO audit_records(actor_id,action,target_type,target_id) VALUES($1,$2,'user',$1::text)`, [id, remove ? 'account_deleted' : 'account_deactivated']);
  return true;
});
