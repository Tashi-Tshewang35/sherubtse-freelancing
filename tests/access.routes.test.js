jest.mock('../config/mailer', () => ({ sendVerificationEmail: jest.fn().mockResolvedValue(undefined) }));
const request = require('supertest');
const app = require('../app');
const db = require('../config/db');
const fixtures = require('./helpers/fixtures')();
const { sendVerificationEmail } = require('../config/mailer');
let student, employer, dual, admin, pending;
async function login(user) {
  const agent = request.agent(app);
  await agent.post('/login').type('form').send({ email: user.email, password: fixtures.password }).expect(302).expect('Location','/dashboard');
  return agent;
}
beforeAll(async () => {
  await fixtures.connect();
  student = await fixtures.account(true,false);
  employer = await fixtures.account(false,true);
  dual = await fixtures.account(true,true);
  admin = await fixtures.account(false,false,true);
  pending = await fixtures.account(false,true,false,false);
});
afterAll(() => fixtures.cleanup());

describe('Public pages and safe errors', () => {
  test.each(['/', '/login', '/signup', '/jobs', '/resend-verification'])('GET %s renders', async path => {
    const response = await request(app).get(path);
    expect(response.status).toBe(200);
    expect(response.text).toContain('Sherubtse Freelancing');
  });
  test('missing page is friendly and does not expose a stack trace', async () => {
    const response = await request(app).get('/not-a-real-page');
    expect(response.status).toBe(404);
    expect(response.text).not.toMatch(/Error:|password_hash|DB_PASS|at .*\.js:\d+/);
  });
});
describe('Authentication boundaries', () => {
  test.each(['/dashboard','/profile','/admin','/jobs/new','/notifications'])('redirects logged-out GET %s to login', async path => {
    await request(app).get(path).expect(302).expect('Location','/login');
  });
  test('calendar API returns safe 401 JSON rather than redirecting', async () => {
    const response = await request(app).get('/api/calendar');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Authentication required.' });
  });
  test('invalid signup creates no account and sends no email', async () => {
    const response = await request(app).post('/signup').type('form').send({ name:'Invalid student',email:'invalid-unit6@example.invalid',password:'123456',accountType:'student' });
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/signup');
    expect(await db.oneOrNone('SELECT id FROM users WHERE email=$1',['invalid-unit6@example.invalid'])).toBeNull();
    expect(sendVerificationEmail).not.toHaveBeenCalled();
  });
  test('invalid login stays logged out', async () => {
    const agent = request.agent(app);
    await agent.post('/login').type('form').send({ email:student.email,password:'wrong' }).expect(302).expect('Location','/login');
    await agent.get('/dashboard').expect(302).expect('Location','/login');
  });
});
describe('Student, employer, dual and admin authorization', () => {
  test('student can update availability but employer-only account cannot', async () => {
    await (await login(student)).post('/profile/availability').type('form').send({status:'active'}).expect(302);
    await (await login(employer)).post('/profile/availability').type('form').send({status:'active'}).expect(403);
  });
  test('only approved employer and dual-role accounts can open the work form', async () => {
    await (await login(employer)).get('/jobs/new').expect(200);
    await (await login(dual)).get('/jobs/new').expect(200);
    await (await login(student)).get('/jobs/new').expect(403);
    await (await login(pending)).get('/jobs/new').expect(403);
  });
  test('only administrator can open account management', async () => {
    await (await login(admin)).get('/admin').expect(200);
    await (await login(student)).get('/admin').expect(403);
    await (await login(employer)).get('/admin').expect(403);
  });
  test('authenticated calendar responds and logout ends the session', async () => {
    const agent = await login(dual);
    const response = await agent.get('/api/calendar');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.headers['cache-control']).toBe('no-store');
    await agent.post('/logout').expect(302);
    await agent.get('/api/calendar').expect(401);
  });
});
