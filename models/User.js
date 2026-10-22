const bcrypt = require('bcrypt');
const db = require('../config/db');
const { hashToken } = require('../config/verification');

async function createUser({ name, email, password, accountType, verificationToken, verificationExpiresAt }) {
  const normalizedEmail = email.trim().toLowerCase();
  const isStudent = ['student', 'employee', 'both'].includes(accountType);
  const wantsEmployer = accountType === 'employer' || accountType === 'both';
  const passwordHash = await bcrypt.hash(password, 10);

  return db.one(
    `INSERT INTO users
      (name, email, password_hash, is_student, is_employer, employer_status, verification_token, verification_expires_at, verification_sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
     RETURNING id, name, email, is_student, is_employer, employer_status, is_verified, is_admin`,
    [name.trim(), normalizedEmail, passwordHash, isStudent, wantsEmployer, wantsEmployer ? 'pending' : 'not_requested', verificationToken, verificationExpiresAt]
  );
}

function findByEmail(email) {
  return db.oneOrNone('SELECT * FROM users WHERE email = $1', [email.trim().toLowerCase()]);
}

function findById(id) {
  return db.oneOrNone(
    `SELECT id, name, email, is_student, is_employer, employer_status,
            is_verified, is_admin, availability_status, created_at
     FROM users WHERE id = $1`,
    [id]
  );
}

function listPendingEmployers() {
  return db.any(
    `SELECT id, name, email, created_at FROM users
     WHERE is_employer = true AND employer_status = 'pending' AND is_verified = true
     ORDER BY created_at`
  );
}

function listAvailableStudents(startAt, endAt) {
  return db.any(
    `SELECT u.id, u.name, u.email, u.availability_status
     FROM users u
     WHERE u.is_student = true
       AND u.is_verified = true
       AND u.availability_status = 'active'
       AND NOT EXISTS (
         SELECT 1
         FROM applications a
         JOIN jobs j ON j.id = a.job_id
         WHERE a.student_id = u.id
           AND a.status IN ('accepted', 'in_progress', 'completed')
           AND tstzrange(j.start_at, j.end_at, '[)') && tstzrange($1, $2, '[)')
       )
       AND NOT EXISTS (
         SELECT 1 FROM calendar_tasks ct
         WHERE ct.user_id = u.id
           AND tstzrange(ct.start_at, ct.end_at, '[)') && tstzrange($1, $2, '[)')
       )
     ORDER BY u.name`,
    [startAt, endAt]
  );
}

function verifyPassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

function markVerified(token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return Promise.resolve(null);
  return db.oneOrNone(
    `UPDATE users SET is_verified = true, verification_token = NULL,
       verification_expires_at = NULL, verification_sent_at = NULL
     WHERE verification_token = $1 AND is_verified = false
       AND verification_expires_at > NOW()
     RETURNING id, name, email, is_student, is_employer, employer_status, is_admin`,
    [hashToken(token)]
  );
}

function renewVerification(userId, hash, expiresAt) {
  return db.oneOrNone(
    `UPDATE users SET verification_token = $2, verification_expires_at = $3,
       verification_sent_at = NOW()
     WHERE id = $1 AND is_verified = false
       AND (verification_sent_at IS NULL OR verification_sent_at < NOW() - INTERVAL '1 minute')
     RETURNING id, email`, [userId, hash, expiresAt]
  );
}

function allowVerificationRetry(userId, hash) {
  return db.none(
    `UPDATE users SET verification_sent_at = NULL
     WHERE id = $1 AND verification_token = $2 AND is_verified = false`, [userId, hash]
  );
}

function approveEmployer(userId) {
  return db.oneOrNone(
    `UPDATE users SET employer_status = 'approved'
     WHERE id = $1 AND is_employer = true
     RETURNING id, name, email`,
    [userId]
  );
}

function rejectEmployer(userId) {
  return db.oneOrNone(
    `UPDATE users SET employer_status = 'rejected'
     WHERE id = $1 AND is_employer = true
     RETURNING id, name, email`,
    [userId]
  );
}

function updateAvailability(userId, status) {
  return db.tx(async t => {
    const user = await t.one('UPDATE users SET availability_status=$2 WHERE id=$1 RETURNING id,availability_status', [userId,status]);
    // A deliberate manual change must not be overridden when work completes.
    await t.none('UPDATE student_profiles SET availability_before_work=NULL WHERE user_id=$1', [userId]);
    return user;
  });
}

module.exports = {
  createUser, findByEmail, findById, listPendingEmployers, listAvailableStudents,
  verifyPassword, markVerified, approveEmployer, rejectEmployer, updateAvailability,
  renewVerification, allowVerificationRetry,
};
