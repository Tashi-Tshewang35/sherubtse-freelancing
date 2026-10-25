const db = require('../config/db');
async function restore(t, studentId) {
  await t.none(`UPDATE users u SET availability_status=COALESCE(sp.availability_before_work,'active') FROM student_profiles sp
    WHERE u.id=$1 AND sp.user_id=u.id AND NOT EXISTS(SELECT 1 FROM applications WHERE student_id=$1 AND status IN ('accepted','in_progress'))`, [studentId]);
  await t.none(`UPDATE student_profiles SET availability_before_work=NULL WHERE user_id=$1
    AND NOT EXISTS(SELECT 1 FROM applications WHERE student_id=$1 AND status IN ('accepted','in_progress'))`, [studentId]);
}
async function cancel(t, id, employerId, note = 'Work cancelled by the employer.') {
  // Lock students in ascending order before locking the posting, matching acceptance.
  const candidates = await t.any(`SELECT DISTINCT student_id FROM applications WHERE job_id=$1 AND status IN ('pending','under_review','invited','accepted','in_progress') ORDER BY student_id`, [id]);
  for (const student of candidates) await t.one('SELECT id FROM users WHERE id=$1 FOR UPDATE', [student.student_id]);
  const job = await t.oneOrNone(`UPDATE jobs SET status='cancelled' WHERE id=$1 AND employer_id=$2 AND status IN ('open','closed','draft') RETURNING id`, [id, employerId]);
  if (!job) return null;
  const affected = await t.any(`UPDATE applications SET status='withdrawn',decided_at=NOW(),decision_note=$2
    WHERE job_id=$1 AND status IN ('pending','under_review','invited','accepted','in_progress') RETURNING student_id`, [id, note]);
  for (const student of affected) await restore(t, student.student_id);
  return job;
}
exports.cancel = (id, employerId) => db.tx(t => cancel(t, id, employerId));
exports.cancelInTransaction = cancel;
exports.restore = restore;
