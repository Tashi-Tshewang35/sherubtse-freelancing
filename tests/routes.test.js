const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('../config/db');
const { connectMongo, getMongoDb, closeMongo } = require('../config/mongo');
const app = require('../app');
const supertest = require('supertest');

test('HTTP pages and profile, posting, application, recruitment, rating and admin workflows', async () => {
  const ids = [];
  try {
    await require('../config/checkSchema').checkSchema();
    await connectMongo();
    const password = 'RouteTest123!';
    const hash = await bcrypt.hash(password, 10);
    async function account(student, employer, admin = false) {
      const email = student
        ? String(80000000 + crypto.randomInt(9999999)) + '.sherubtse@rub.edu.bt'
        : crypto.randomUUID() + '@example.com';
      const user = await db.one(`INSERT INTO users(name,email,password_hash,is_student,is_employer,is_admin,is_verified,employer_status)
        VALUES('HTTP workflow test',$1,$2,$3,$4,$5,true,$6) RETURNING id`,
        [email, hash, student, employer, admin, employer ? 'approved' : 'not_requested']);
      ids.push(user.id);
      const agent = supertest.agent(app);
      const response = await agent.post('/login').type('form').send({ email, password });
      assert.equal(response.headers.location, '/dashboard');
      return { id: user.id, agent };
    }
    // An agent remembers login cookies, exactly as taught in Lab 9.
    function request(route, user, data) {
      const client = user ? user.agent : supertest(app);
      return data ? client.post(route).type('form').send(data) : client.get(route);
    }
    const student = await account(true, false);
    const employer = await account(false, true);
    const other = await account(false, true);
    const dual = await account(true, true);
    const admin = await account(false, false, true);
    for (const user of [student, employer, other, dual, admin]) {
      for (const route of ['/', '/jobs', '/dashboard', '/profile', '/api/calendar']) {
        const response = await request(route, user);
        assert.equal(response.status, 200, route);
        if (route !== '/api/calendar') assert.ok(!(response.text).includes('Something went wrong'));
      }
    }
    const skill = await db.one('SELECT id FROM skills WHERE predefined ORDER BY id LIMIT 1');
    assert.equal((await request('/profile/student', student, {
      name: 'HTTP student', bio: 'Available for campus work', availability: 'active',
      skills: [skill.id], customSkills: 'HTTP custom skill\nhttp CUSTOM skill',
    })).status, 302);
    assert.equal((await db.one('SELECT COUNT(*)::int AS count FROM user_skills WHERE user_id=$1', [student.id])).count, 2);
    const type = await db.one("SELECT id FROM employer_types WHERE name='Other'");
    assert.equal((await request('/profile/employer', employer, {
      name: 'HTTP employer', businessName: 'HTTP business', typeId: type.id,
      customType: 'Campus service', description: 'Test description', location: 'Kanglung', contactNumber: '12345678',
    })).status, 302);
    function localDate(ms) { return require('../public/js/dateTimeInput').display(ms); }
    const now = Date.now();
    const data = {
      title: 'HTTP test work', description: 'Test posting', workType: 'Cleaning', location: 'Kanglung',
      wageRate: 100, wageUnit: 'hour', workersNeeded: 2, urgency: 'urgent', status: 'open',
      opensAt: localDate(now - 3600000), closesAt: localDate(now + 3600000),
      startAt: localDate(now + 86400000), endAt: localDate(now + 90000000),
    };
    const scheduledResponse = await request('/jobs', employer, {
      ...data, title: 'Future-opening calendar test', opensAt: localDate(now + 1800000),
    });
    const scheduledId = Number(scheduledResponse.headers['location'].split('/').at(-1));
    let scheduledCalendar = (await request('/api/calendar', employer)).body;
    assert.equal(scheduledCalendar.find(event => event.id === scheduledId).status, 'scheduled');
    for (const employee of [student, dual]) {
      const response = await request('/api/calendar', employee);
      assert.equal(response.headers['cache-control'], 'no-store');
      assert.ok(!(response.body).some(event => event.id === scheduledId));
    }
    await db.none("UPDATE jobs SET application_opens_at=NOW()-INTERVAL '1 minute' WHERE id=$1", [scheduledId]);
    for (const employee of [student, dual]) {
      const available = (await request('/api/calendar', employee)).body;
      assert.equal(available.find(event => event.id === scheduledId).status, 'open');
    }
    assert.ok(!((await request('/api/calendar', other)).body).some(event => event.id === scheduledId));
    await db.none("UPDATE jobs SET application_opens_at=NOW()-INTERVAL '3 minutes',application_closes_at=NOW()-INTERVAL '1 minute' WHERE id=$1", [scheduledId]);
    assert.ok(!((await request('/api/calendar', student)).body).some(event => event.id === scheduledId));
    assert.equal(((await request('/api/calendar', employer)).body).find(event => event.id === scheduledId).status, 'closed');
    const created = await request('/jobs', employer, data);
    assert.equal(created.status, 302);
    const jobUrl = created.headers['location'];
    const jobId = Number(jobUrl.split('/').at(-1));
    assert.equal((await request(jobUrl, employer)).status, 200);
    assert.equal((await request(jobUrl, student)).status, 200);
    assert.equal((await request(jobUrl, other)).status, 403);
    assert.equal((await request(jobUrl, dual)).status, 200);
    let response = await request('/api/calendar', other);
    assert.ok(!(response.body).some(event => event.id === jobId && event.event_type === 'work'));
    response = await request('/api/calendar', dual);
    assert.ok((response.body).some(event => event.id === jobId));
    assert.equal((await request(jobUrl + '/apply', student, { coverNote: 'Ready to work' })).status, 302);
    const application = await db.one('SELECT id FROM applications WHERE job_id=$1 AND student_id=$2', [jobId, student.id]);
    assert.equal((await request(jobUrl + '/applicants', employer)).status, 200);
    assert.equal((await request('/profiles/' + student.id, employer)).status, 200);
    assert.equal((await request('/profiles/' + student.id, other)).status, 403);
    assert.equal((await request('/applications/' + application.id + '/accept', employer, {})).status, 302);
    assert.equal((await db.one('SELECT status FROM applications WHERE id=$1', [application.id])).status, 'accepted');
    assert.equal((await request('/applications/' + application.id + '/complete', employer, {})).status, 302);
    assert.equal((await request('/applications/' + application.id + '/rate', employer, { score: 5, comment: 'HTTP rating test' })).status, 302);
    response = await request('/profile', student);
    assert.ok((response.text).includes('HTTP rating test'));
    // Consent, conflict withdrawal and work progress use the existing HTTP endpoints.
    const inviteResponse = await request('/jobs', employer, { ...data, title: 'Invitation workflow test' });
    const inviteUrl = inviteResponse.headers['location'];
    const inviteJobId = Number(inviteUrl.split('/').at(-1));
    const overlapResponse = await request('/jobs', employer, { ...data, title: 'Overlapping application test' });
    const overlapUrl = overlapResponse.headers['location'];
    await request(overlapUrl + '/apply', dual, { coverNote: 'Will be withdrawn only after confirmation' });
    await request(inviteUrl + '/recruit', employer, { studentId: dual.id });
    const invitation = await db.one('SELECT id,status FROM applications WHERE job_id=$1 AND student_id=$2', [inviteJobId, dual.id]);
    assert.equal(invitation.status, 'invited');
    assert.equal((await db.one('SELECT status FROM applications WHERE job_id=$1 AND student_id=$2', [Number(overlapUrl.split('/').at(-1)), dual.id])).status, 'pending');
    await request('/applications/' + invitation.id + '/confirm', student, {});
    assert.equal((await db.one('SELECT status FROM applications WHERE id=$1', [invitation.id])).status, 'invited', 'another student cannot confirm');
    await request('/applications/' + invitation.id + '/confirm', dual, {});
    assert.equal((await db.one('SELECT status FROM applications WHERE id=$1', [invitation.id])).status, 'accepted');
    assert.equal((await db.one('SELECT status FROM applications WHERE job_id=$1 AND student_id=$2', [Number(overlapUrl.split('/').at(-1)), dual.id])).status, 'withdrawn');
    assert.equal((await db.one('SELECT availability_status FROM users WHERE id=$1',[dual.id])).availability_status,'inactive');
    await request('/applications/' + invitation.id + '/start', employer, {});
    assert.equal((await db.one('SELECT status FROM applications WHERE id=$1', [invitation.id])).status, 'in_progress');
    assert.equal(((await request('/api/calendar', dual)).body).find(event=>event.id===inviteJobId).status, 'in_progress');
    await request('/applications/' + invitation.id + '/complete', employer, {});
    assert.equal((await db.one('SELECT status FROM applications WHERE id=$1', [invitation.id])).status, 'completed');
    assert.equal((await db.one('SELECT availability_status FROM users WHERE id=$1',[dual.id])).availability_status,'active');
    const declineResponse = await request('/jobs', employer, { ...data, title: 'Decline invitation test', startAt: localDate(now+172800000), endAt: localDate(now+176400000) });
    const declineUrl = declineResponse.headers['location'];
    await request(declineUrl + '/recruit', employer, { studentId: dual.id });
    const toDecline = await db.one('SELECT id FROM applications WHERE job_id=$1 AND student_id=$2', [Number(declineUrl.split('/').at(-1)), dual.id]);
    await request('/applications/' + toDecline.id + '/decline', dual, {});
    assert.equal((await db.one('SELECT status FROM applications WHERE id=$1', [toDecline.id])).status, 'declined');
    const notice = await db.one('SELECT id FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 1', [dual.id]);
    assert.equal((await request('/notifications', dual)).status, 200);
    await request('/notifications/' + notice.id + '/read', student, {});
    assert.equal((await db.one('SELECT is_read FROM notifications WHERE id=$1', [notice.id])).is_read, false);
    await request('/notifications/' + notice.id + '/read', dual, {});
    assert.equal((await db.one('SELECT is_read FROM notifications WHERE id=$1', [notice.id])).is_read, true);
    await request('/notifications/read-all', dual, {});
    assert.equal((await db.one('SELECT COUNT(*)::int AS count FROM notifications WHERE user_id=$1 AND NOT is_read', [dual.id])).count, 0);
    const draftResponse = await request('/jobs', employer, { ...data, status: 'draft', title: 'Draft </script> test' });
    const draftUrl = draftResponse.headers['location'];
    response = await request(draftUrl + '/edit', employer);
    assert.equal(response.status, 200);
    const draftHtml=response.text;
    assert.ok(draftHtml.includes('draftData'));
    const draftJson=draftHtml.match(/id="draftData">([\s\S]*?)<\/script>/)[1];
    assert.equal(JSON.parse(draftJson).title, 'Draft </script> test');
    assert.ok(!draftJson.includes('</script>'));
    assert.equal((await request(draftUrl + '/edit', employer, { ...data, title: 'Edited draft', status: 'draft' })).status, 302);
    assert.equal((await request(draftUrl + '/publish', employer, {})).status, 302);
    assert.equal((await request('/admin', admin)).status, 200);
    for (const status of ['pending', 'accepted', 'rejected', 'withdrawn', 'completed']) {
      assert.equal((await request('/admin?status=' + status + '&role=student&q=HTTP', admin)).status, 200);
    }
    for (const approval of ['pending', 'approved', 'rejected']) {
      assert.equal((await request('/admin?approval=' + approval + '&role=both', admin)).status, 200);
    }
    assert.equal((await request('/admin', student)).status, 403);
    assert.equal((await request('/jobs/new', student)).status, 403);
    await db.none("UPDATE users SET employer_status='rejected' WHERE id=$1", [other.id]);
    assert.equal((await request('/jobs/new', other)).status, 403);
  } finally {
    if (ids.length) {
      await getMongoDb().collection('ratings').deleteMany({ employerId: { $in: ids } });
      await getMongoDb().collection('sessions').deleteMany({ 'session.user.id': { $in: ids } });
      await db.none('DELETE FROM applications WHERE student_id IN ($1:csv) OR job_id IN (SELECT id FROM jobs WHERE employer_id IN ($1:csv))', [ids]);
      await db.none('DELETE FROM jobs WHERE employer_id IN ($1:csv)', [ids]);
      await db.none('DELETE FROM users WHERE id IN ($1:csv)', [ids]);
      await db.none("DELETE FROM skills WHERE name IN ('HTTP custom skill','HTTP test skill') AND NOT EXISTS(SELECT 1 FROM user_skills WHERE skill_id=skills.id)");
    }
    await closeMongo();
    await db.$pool.end();
  }
});
