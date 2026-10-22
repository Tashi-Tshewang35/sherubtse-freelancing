jest.mock('../config/mailer', () => ({ sendVerificationEmail: jest.fn().mockResolvedValue(undefined) }));
const request = require('supertest');
const app = require('../app');
const db = require('../config/db');
const { sendVerificationEmail } = require('../config/mailer');
const { hashToken } = require('../config/verification');
const fixtures = require('./helpers/fixtures')();
const crypto = require('crypto');
beforeAll(() => fixtures.connect());
afterAll(() => fixtures.cleanup());
test('signup gives the mocked mailer a token whose hash is stored, then verifies and logs in', async () => {
  // Arrange: a valid eight-digit education email, not a real mailbox.
  const email = String(60000000+crypto.randomInt(9999999))+'.sherubtse@rub.edu.bt';
  const agent = request.agent(app);
  // Act: go through the real signup controller and PostgreSQL model.
  const response = await agent.post('/signup').type('form').send({ name:'Unit 6 student',email,password:fixtures.password,accountType:'both' });
  const saved = await db.one('SELECT id,is_verified,verification_token FROM users WHERE email=$1',[email]);
  fixtures.track(saved.id);
  // Assert: sending is mocked, but identity and verification state are real.
  expect(response.status).toBe(200);
  expect(sendVerificationEmail).toHaveBeenCalledTimes(1);
  expect(sendVerificationEmail).toHaveBeenCalledWith(email,expect.any(String));
  const token = sendVerificationEmail.mock.calls[0][1];
  expect(saved.is_verified).toBe(false);
  expect(saved.verification_token).toBe(hashToken(token));
  expect(saved.verification_token).not.toBe(token);
  await agent.get('/verify/'+token).expect(200);
  await agent.post('/login').type('form').send({email,password:fixtures.password}).expect(302).expect('Location','/dashboard');
  await agent.get('/dashboard').expect(200);
});
