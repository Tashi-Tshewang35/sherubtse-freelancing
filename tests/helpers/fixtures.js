const crypto = require('crypto');
const bcrypt = require('bcrypt');
const db = require('../../config/db');
const { connectMongo, getMongoDb, closeMongo } = require('../../config/mongo');
const { assertTestDatabases } = require('../../config/testEnvironment');
const password = 'Unit6TestPassword!';
function fixtures() {
  const ids = [];
  return {
    password,
    async connect() { assertTestDatabases(process.env); await connectMongo(); },
    async account(student, employer, admin = false, approved = true) {
      const email = student ? String(80000000 + crypto.randomInt(9999999)) + '.sherubtse@rub.edu.bt' : crypto.randomUUID() + '@example.invalid';
      const user = await db.one(`INSERT INTO users(name,email,password_hash,is_student,is_employer,is_admin,is_verified,employer_status)
        VALUES('Unit 6 test',$1,$2,$3,$4,$5,true,$6) RETURNING id,email`,
        [email,await bcrypt.hash(password,10),student,employer,admin,employer ? approved ? 'approved' : 'pending' : 'not_requested']);
      ids.push(user.id); return user;
    },
    track(id) { ids.push(id); },
    async cleanup() {
      assertTestDatabases(process.env);
      try {
        if (ids.length) {
          await getMongoDb().collection('ratings').deleteMany({ employerId: { $in: ids } });
          await db.none('DELETE FROM applications WHERE student_id IN ($1:csv) OR job_id IN (SELECT id FROM jobs WHERE employer_id IN ($1:csv))',[ids]);
          await db.none('DELETE FROM jobs WHERE employer_id IN ($1:csv)',[ids]);
          await db.none('DELETE FROM users WHERE id IN ($1:csv)',[ids]);
        }
        // Sessions, including anonymous validation sessions, belong to this test database only.
        await getMongoDb().collection('sessions').deleteMany({});
      } finally { await closeMongo(); await db.$pool.end(); }
    },
  };
}
module.exports = fixtures;
