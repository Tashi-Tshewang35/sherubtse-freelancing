const fs = require('fs');
const crypto = require('crypto');
const db = require('../config/db');

afterAll(() => db.$pool.end());
test('professional upgrade can repeat without losing existing identity or extended application progress', async () => {
  const rollback = new Error('ROLLBACK_MIGRATION_TEST');
  try {
    await db.tx(async transaction => {
      // Arrange: existing records with a newer status, plus an old verification value.
      const email = String(50000000 + crypto.randomInt(9999999)) + '.sherubtse@rub.edu.bt';
      const student = await transaction.one(`INSERT INTO users(name,email,password_hash,is_student,is_verified)
        VALUES('Keep this student',$1,'test-only-hash',true,true) RETURNING id`, [email]);
      const employer = await transaction.one(`INSERT INTO users(name,email,password_hash,is_employer,is_verified,employer_status)
        VALUES('Keep this employer',$1,'test-only-hash',true,true,'approved') RETURNING id`, [crypto.randomUUID()+'@example.invalid']);
      const job = await transaction.one(`INSERT INTO jobs(employer_id,title,description,work_type,location,wage_rate,wage_unit,workers_needed,start_at,end_at,application_opens_at,application_closes_at,published_at)
        VALUES($1,'Keep this work','Existing description','Cleaning','Kanglung',100,'hour',1,NOW()+INTERVAL '2 days',NOW()+INTERVAL '3 days',NOW()-INTERVAL '1 day',NOW()+INTERVAL '1 day',NOW()) RETURNING id`, [employer.id]);
      const application = await transaction.one("INSERT INTO applications(job_id,student_id,status) VALUES($1,$2,'in_progress') RETURNING id", [job.id,student.id]);
      const sql = fs.readFileSync('database/migrations/001_professional_upgrade.sql','utf8').replace(/^BEGIN;\s*/m,'').replace(/^COMMIT;\s*/m,'');
      // Act: rerun the combined upgrade twice inside a rolled-back test transaction.
      await transaction.none(sql);
      await transaction.none(sql);
      // Assert: identity, description and extended progress survive.
      expect(await transaction.one('SELECT name,email FROM users WHERE id=$1',[student.id])).toEqual({ name:'Keep this student',email });
      expect((await transaction.one('SELECT description FROM jobs WHERE id=$1',[job.id])).description).toBe('Existing description');
      expect((await transaction.one('SELECT status FROM applications WHERE id=$1',[application.id])).status).toBe('in_progress');
      throw rollback;
    });
  } catch (error) { if (error !== rollback) throw error; }
});
