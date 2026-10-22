const db = require('../config/db');

function apply(jobId, studentId, coverNote) {
  return db.tx(async t => {
    // Use the same lock order as recruitment: student first, posting second.
    const student = await t.oneOrNone('SELECT id FROM users WHERE id=$1 FOR UPDATE', [studentId]);
    const job = await t.oneOrNone('SELECT id FROM jobs WHERE id=$1 FOR UPDATE', [jobId]);
    if (!student || !job) return null;
    return t.oneOrNone(
      `INSERT INTO applications (job_id, student_id, cover_note, status, source)
       SELECT j.id,u.id,$3,'pending','application'
       FROM jobs j JOIN users u ON u.id=$2 JOIN users e ON e.id=j.employer_id
       WHERE j.id=$1 AND j.employer_id<>$2 AND u.is_student AND u.is_verified
         AND j.status='open' AND j.published_at IS NOT NULL
         AND e.employer_status='approved' AND e.is_verified
         AND j.application_opens_at<=NOW() AND j.application_closes_at>NOW()
         AND NOT EXISTS (
           SELECT 1 FROM applications busy JOIN jobs bj ON bj.id=busy.job_id
           WHERE busy.student_id=$2 AND busy.status IN ('accepted','in_progress','completed')
             AND tstzrange(bj.start_at,bj.end_at,'[)') && tstzrange(j.start_at,j.end_at,'[)')
         )
         AND NOT EXISTS (
           SELECT 1 FROM calendar_tasks ct WHERE ct.user_id=$2
             AND tstzrange(ct.start_at,ct.end_at,'[)') && tstzrange(j.start_at,j.end_at,'[)')
         )
       ON CONFLICT (job_id,student_id) DO NOTHING RETURNING *`,
      [jobId,studentId,coverNote || null]
    );
  });
}

function getStudentApplications(studentId) {
  return db.any(
    `SELECT a.*, j.title, j.work_type, j.location, j.start_at, j.end_at,
            j.wage_rate, j.wage_unit, COALESCE(ep.business_name,u.name) AS employer_name
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     JOIN users u ON u.id = j.employer_id
     LEFT JOIN employer_profiles ep ON ep.user_id=u.id
     WHERE a.student_id = $1 ORDER BY a.created_at DESC`,
    [studentId]
  );
}

function getJobApplicants(jobId, employerId) {
  return db.any(
    `SELECT a.*, u.name, u.email, u.availability_status, sp.programme, sp.study_year,
            CASE WHEN EXISTS(SELECT 1 FROM applications busy JOIN jobs bj ON bj.id=busy.job_id WHERE busy.student_id=u.id AND busy.status IN ('accepted','in_progress','completed') AND tstzrange(bj.start_at,bj.end_at,'[)') && tstzrange(j.start_at,j.end_at,'[)')) OR EXISTS(SELECT 1 FROM calendar_tasks ct WHERE ct.user_id=u.id AND tstzrange(ct.start_at,ct.end_at,'[)') && tstzrange(j.start_at,j.end_at,'[)')) THEN 'inactive for this schedule' ELSE u.availability_status END AS schedule_availability,
            (SELECT string_agg(s.name, ', ' ORDER BY s.name) FROM user_skills us JOIN skills s ON s.id=us.skill_id WHERE us.user_id=u.id) AS skills,
            (SELECT COUNT(*) FROM applications past WHERE past.student_id=u.id AND past.status='completed') AS completed_count,
            COALESCE(rs.average_rating, 0) AS average_rating,
            COALESCE(rs.rating_count, 0) AS rating_count
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     JOIN users u ON u.id = a.student_id
     LEFT JOIN student_profiles sp ON sp.user_id=u.id
     LEFT JOIN rating_summary rs ON rs.student_id = u.id
     WHERE a.job_id = $1 AND j.employer_id = $2
     ORDER BY a.created_at`,
    [jobId, employerId]
  );
}

function accept(applicationId, employerId, studentId = null) {
  return db.tx(async (t) => {
    const candidate = await t.oneOrNone('SELECT student_id FROM applications WHERE id=$1', [applicationId]);
    if (!candidate) return null;
    await t.one('SELECT id FROM users WHERE id=$1 FOR UPDATE', [candidate.student_id]);
    const application = await t.oneOrNone(
      `SELECT a.*, j.start_at, j.end_at, j.workers_needed
       FROM applications a JOIN jobs j ON j.id = a.job_id
       WHERE a.id = $1 AND j.employer_id = $2 AND ((a.status = 'pending' AND $3::int IS NULL) OR (a.status='invited' AND a.student_id=$3)) AND j.status='open' AND j.published_at IS NOT NULL AND j.application_opens_at<=NOW() AND j.end_at>NOW() AND ($3::int IS NULL OR j.start_at>NOW())
       AND EXISTS(SELECT 1 FROM users owner WHERE owner.id=j.employer_id AND owner.employer_status='approved' AND owner.is_verified)
       FOR UPDATE`,
      [applicationId, employerId, studentId]
    );
    if (!application) return null;

    const filled = await t.one(
      `SELECT COUNT(*)::int AS count FROM applications
       WHERE job_id = $1 AND status IN ('accepted', 'in_progress', 'completed')`,
      [application.job_id]
    );
    if (filled.count >= application.workers_needed) throw new Error('All positions for this job are already filled.');

    const clash = await t.oneOrNone(
      `SELECT a.id FROM applications a JOIN jobs j ON j.id = a.job_id
       WHERE a.student_id = $1 AND a.status IN ('accepted','in_progress','completed')
         AND tstzrange(j.start_at, j.end_at, '[)') && tstzrange($2, $3, '[)')
       LIMIT 1`,
      [application.student_id, application.start_at, application.end_at]
    );
    if (clash) throw new Error('This student is already assigned during that time.');

    const personalClash = await t.oneOrNone(
      `SELECT id FROM calendar_tasks
       WHERE user_id = $1
         AND tstzrange(start_at, end_at, '[)') && tstzrange($2, $3, '[)')
       LIMIT 1`,
      [application.student_id, application.start_at, application.end_at]
    );
    if (personalClash) throw new Error('The student has a calendar task during that time.');

    await t.none(`UPDATE student_profiles sp SET availability_before_work=COALESCE(sp.availability_before_work,u.availability_status) FROM users u WHERE sp.user_id=u.id AND sp.user_id=$1`, [application.student_id]);
    await t.none("UPDATE users SET availability_status='inactive' WHERE id=$1", [application.student_id]);
    await t.none(`UPDATE applications SET status = 'accepted', decided_at = NOW() WHERE id = $1`, [applicationId]);
    await t.none(
      `UPDATE applications a SET status = 'withdrawn', decided_at = NOW(), decision_note='Automatically withdrawn because you confirmed overlapping work.'
       FROM jobs other_job
       WHERE a.job_id = other_job.id
         AND a.student_id = $1 AND a.id <> $2 AND a.status IN ('pending','invited')
         AND tstzrange(other_job.start_at, other_job.end_at, '[)') && tstzrange($3, $4, '[)')`,
      [application.student_id, applicationId, application.start_at, application.end_at]
    );

    return application;
  });
}

function reject(applicationId, employerId, note = '') {
  return db.oneOrNone(
    `UPDATE applications a SET status = 'rejected', decided_at = NOW(), decision_note=$3
     FROM jobs j WHERE a.job_id = j.id AND a.id = $1 AND j.employer_id = $2 AND a.status IN ('pending','invited')
     RETURNING a.*`,
    [applicationId, employerId, note]
  );
}

function directRecruit(jobId, studentId, employerId) {
  return db.tx(async (t) => {
    await t.one('SELECT id FROM users WHERE id=$1 FOR UPDATE',[studentId]);
    const job = await t.oneOrNone(
      `SELECT * FROM jobs WHERE id = $1 AND employer_id = $2
       AND urgency = 'urgent' AND status = 'open' AND published_at IS NOT NULL AND application_opens_at<=NOW() AND application_closes_at>NOW() FOR UPDATE`,
      [jobId, employerId]
    );
    if (!job) throw new Error('Direct recruitment is available only for your open urgent jobs.');

    const filled = await t.one(
      `SELECT COUNT(*)::int AS count FROM applications
       WHERE job_id = $1 AND status IN ('accepted', 'in_progress', 'completed')`,
      [jobId]
    );
    if (filled.count >= job.workers_needed) throw new Error('All positions for this job are already filled.');

    const student = await t.oneOrNone(
      `SELECT id FROM users WHERE id = $1 AND id <> $2 AND is_student = true
       AND is_verified = true AND availability_status = 'active'`,
      [studentId, employerId]
    );
    if (!student) throw new Error('The selected student is currently unavailable.');

    const conflict = await t.oneOrNone(
      `SELECT a.id FROM applications a JOIN jobs j ON j.id = a.job_id
       WHERE a.student_id = $1 AND a.status IN ('accepted','in_progress','completed')
         AND tstzrange(j.start_at, j.end_at, '[)') && tstzrange($2, $3, '[)') LIMIT 1`,
      [studentId, job.start_at, job.end_at]
    );
    if (conflict) throw new Error('The selected student is unavailable during this job.');

    const personalConflict = await t.oneOrNone(
      `SELECT id FROM calendar_tasks
       WHERE user_id = $1
         AND tstzrange(start_at, end_at, '[)') && tstzrange($2, $3, '[)')
       LIMIT 1`,
      [studentId, job.start_at, job.end_at]
    );
    if (personalConflict) throw new Error('The selected student has a calendar task during this job.');

    const recruited = await t.one(
      `INSERT INTO applications (job_id, student_id, status, source, decided_at)
       VALUES ($1, $2, 'invited', 'direct_recruitment', NOW())
       ON CONFLICT (job_id, student_id)
       DO UPDATE SET status = 'invited', source = 'direct_recruitment', decided_at = NOW() WHERE applications.status IN ('pending','withdrawn','rejected','declined')
       RETURNING *`,
      [jobId, studentId]
    );

    return recruited;
  });
}

function markCompleted(applicationId, employerId) {
  return db.tx(async t => {
    const candidate = await t.oneOrNone('SELECT student_id FROM applications WHERE id=$1', [applicationId]);
    if (!candidate) return null;
    await t.one('SELECT id FROM users WHERE id=$1 FOR UPDATE', [candidate.student_id]);
    const completed = await t.oneOrNone(`UPDATE applications a SET status='completed',completed_at=NOW()
      FROM jobs j WHERE a.job_id=j.id AND a.id=$1 AND j.employer_id=$2
      AND a.status IN ('accepted','in_progress') RETURNING a.*`, [applicationId,employerId]);
    if (!completed) return null;
    const remaining = await t.oneOrNone("SELECT id FROM applications WHERE student_id=$1 AND status IN ('accepted','in_progress') LIMIT 1", [completed.student_id]);
    if (!remaining) {
      await t.none(`UPDATE users u SET availability_status=sp.availability_before_work FROM student_profiles sp
        WHERE sp.user_id=u.id AND u.id=$1 AND sp.availability_before_work IS NOT NULL`, [completed.student_id]);
      await t.none('UPDATE student_profiles SET availability_before_work=NULL WHERE user_id=$1', [completed.student_id]);
    }
    return completed;
  });
}

async function confirm(applicationId, studentId) {
  const invitation = await db.oneOrNone(`SELECT j.employer_id FROM applications a JOIN jobs j ON j.id=a.job_id
    WHERE a.id=$1 AND a.student_id=$2 AND a.status='invited'`, [applicationId, studentId]);
  return invitation ? accept(applicationId, invitation.employer_id, studentId) : null;
}
function decline(applicationId, studentId) {
  return db.oneOrNone("UPDATE applications SET status='declined',decided_at=NOW() WHERE id=$1 AND student_id=$2 AND status='invited' RETURNING id", [applicationId, studentId]);
}
function start(applicationId, employerId) {
  return db.oneOrNone(`UPDATE applications a SET status='in_progress' FROM jobs j
    WHERE a.job_id=j.id AND a.id=$1 AND j.employer_id=$2 AND a.status='accepted' AND j.status NOT IN ('cancelled','draft') RETURNING a.id`, [applicationId, employerId]);
}
module.exports = { confirm, decline, start,
  apply, getStudentApplications, getJobApplicants, accept, reject, directRecruit, markCompleted,
};
