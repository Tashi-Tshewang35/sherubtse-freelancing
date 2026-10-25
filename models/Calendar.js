const db = require('../config/db');

async function getEvents(user) {
  // Employee permission is independent of employer permission for dual-role accounts.
  const work = await db.any(
    `SELECT j.id, j.title, j.start_at AS start, j.end_at AS end, j.location,
            j.application_opens_at, j.application_closes_at, j.published_at,
            j.wage_rate, j.wage_unit, j.urgency, j.status AS work_status,
            j.employer_id = $1 AS is_owner,
            COALESCE(ep.business_name, e.name) AS employer_name,
            a.status AS application_status,
            CASE
              WHEN a.status IN ('invited', 'accepted', 'in_progress', 'completed') THEN a.status
              WHEN j.status = 'draft' THEN 'draft'
              WHEN j.status = 'cancelled' THEN 'cancelled'
              WHEN j.status = 'completed' THEN 'completed'
              WHEN j.status = 'closed' OR j.application_closes_at <= NOW() THEN 'closed'
              WHEN j.application_opens_at > NOW() THEN 'scheduled'
              WHEN a.status IN ('pending','under_review') THEN 'applied'
              ELSE 'open'
            END AS status,
            'work' AS event_type
     FROM jobs j
     JOIN users e ON e.id = j.employer_id
     LEFT JOIN employer_profiles ep ON ep.user_id = e.id
     LEFT JOIN applications a ON a.job_id = j.id AND a.student_id = $1
     WHERE ($3 AND j.employer_id = $1)
        OR ($2 AND (
          a.id IS NOT NULL
          OR (NOT j.is_suspended AND e.account_status='active' AND j.status = 'open' AND j.published_at IS NOT NULL
              AND e.employer_status = 'approved' AND e.is_verified
              AND j.application_closes_at > NOW())
        ))
     ORDER BY j.start_at, j.id`,
    [user.id, Boolean(user.isStudent), Boolean(user.isEmployer)]
  );
  const tasks = await db.any(
    `SELECT id, title, start_at AS start, end_at AS end,
            'personal' AS status, 'personal' AS event_type
     FROM calendar_tasks WHERE user_id = $1`, [user.id]
  );
  return [...work, ...tasks].sort((a, b) => new Date(a.start) - new Date(b.start));
}

function addTask(userId, title, startAt, endAt) {
  return db.one('INSERT INTO calendar_tasks(user_id,title,start_at,end_at) VALUES($1,$2,$3,$4) RETURNING *',
    [userId, title, startAt, endAt]);
}
function deleteTask(id, userId) {
  return db.result('DELETE FROM calendar_tasks WHERE id=$1 AND user_id=$2', [id, userId]);
}
module.exports = { getEvents, addTask, deleteTask };
