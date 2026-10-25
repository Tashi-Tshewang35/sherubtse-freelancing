const assert = require('node:assert/strict');
const supertest = require('supertest');
const express = require('express');
const session = require('express-session');
const nodemailer = require('nodemailer');
const db = require('../config/db');
const { createVerification, hashToken } = require('../config/verification');
const User = require('../models/User');
const auth = require('../controllers/authController');
const { requireStudent, requireApprovedEmployer } = require('../middleware/auth');
const path = require('path');

test('secure unique tokens expire in 24 hours', () => {
 const first = createVerification(), second = createVerification();
 assert.match(first.token, /^[a-f0-9]{64}$/);
 assert.notEqual(first.token, second.token);
 assert.equal(first.hash, hashToken(first.token));
 assert.notEqual(first.hash, first.token);
 assert.ok(first.expiresAt - Date.now() > 86300000);
});

test('PostgreSQL registration, SMTP failure recovery, resend, expiry, verification and login', async () => {
 const savedTransport = nodemailer.createTransport;
 const savedEnv = { user: process.env.GMAIL_USER, password: process.env.GMAIL_APP_PASSWORD, url: process.env.APP_URL };
 const ids = [];
 const sent = [];
 let shouldFail = false;
 process.env.GMAIL_USER = 'test-sender@gmail.com';
 process.env.GMAIL_APP_PASSWORD = 'test-only-password';
 process.env.APP_URL = 'http://localhost:3000';
 nodemailer.createTransport = options => {
  assert.equal(options.service, 'gmail');
  return { sendMail: async mail => {
   if (shouldFail) throw Object.assign(new Error('Test SMTP failure'), { code: 'EAUTH', responseCode: 535 });
   sent.push(mail);
   return { accepted: [mail.to], rejected: [] };
  } };
 };
 try {
  const app = express();
  app.set('view engine','ejs'); app.set('views',path.join(__dirname,'../views'));
  app.use(express.urlencoded({ extended: false }));
  app.use(session({ secret: 'test-session-secret', resave: false, saveUninitialized: false }));
  app.post('/signup',auth.signup); app.post('/resend-verification',auth.resendVerification);
  app.get('/verify/:token',auth.verifyEmail); app.post('/login',auth.login);
  app.post('/verify-link',auth.verifyPastedLink);
  app.get('/student-test',requireStudent,(req,res)=>res.send('student access'));
  app.get('/employer-test',requireApprovedEmployer,(req,res)=>res.send('employer access'));
  const client = supertest(app);
  function post(route, data) { return client.post(route).type('form').send(data); }
  const password = 'FlowTest123!';
  const suffix = Date.now().toString(36);
  for (const [index, type] of ['student','employee','employer','both'].entries()) {
   const email = type === 'employer' ? 'verification-' + suffix + '@example.com' : (70000000 + Math.floor(Math.random()*9000000)).toString() + '.sherubtse@rub.edu.bt';
   const data = { name:'Verification test', email, password, confirmPassword:password, accountType:type };
   let response = await post('/signup',data);
   assert.equal(response.status,200);
   assert.ok((response.text).includes('Check your email'));
   const user = await User.findByEmail(email); ids.push(user.id);
   assert.equal(user.is_student,type!=='employer');
   assert.equal(user.is_employer,['employer','both'].includes(type));
   assert.equal(user.is_verified,false);
   const mail = sent.at(-1);
   const token = mail.text.match(/verify\/([a-f0-9]{64})/)[1];
   assert.ok(mail.html.includes('href="http://localhost:3000/verify/'+token+'"'));
   assert.equal(user.verification_token,hashToken(token));
   assert.notEqual(user.verification_token,token);
   response = await post('/login',{email,password}); assert.equal(response.headers['location'],'/login');
   response = await post('/resend-verification',{email,password}); assert.equal(response.status,302);
   await db.none('UPDATE users SET verification_sent_at = NULL WHERE id = $1',[user.id]);
   response = await post('/resend-verification',{email,password:'wrong'}); assert.equal(response.status,302);
   response = await post('/resend-verification',{email,password}); assert.equal(response.status,200);
   const replacement = sent.at(-1).text.match(/verify\/([a-f0-9]{64})/)[1];
   response = await client.get('/verify/'+token); assert.equal(response.status,302);
   await db.none("UPDATE users SET verification_expires_at = NOW() - INTERVAL '1 hour' WHERE id = $1",[user.id]);
   response = await client.get('/verify/'+replacement); assert.equal(response.status,302);
   await db.none("UPDATE users SET verification_expires_at = NOW() + INTERVAL '1 hour' WHERE id = $1",[user.id]);
   response = await post('/verify-link',{verificationLink:'http://172.16.120.144:3000/verify/'+replacement});
   assert.equal(response.headers['location'],'/verify/'+replacement);
   response = await client.get(response.headers.location); assert.equal(response.status,200);
   const verified = await User.findByEmail(email);
   assert.equal(verified.is_verified,true); assert.equal(verified.verification_token,null);
   if (verified.is_employer) assert.equal(verified.employer_status,'pending');
   response = await client.get('/verify/'+replacement); assert.equal(response.status,302);
   response = await post('/login',{email,password:'wrong'}); assert.equal(response.headers['location'],'/login');
   response = await post('/login',{email,password}); assert.equal(response.headers['location'],'/dashboard');
   const cookie=response.headers['set-cookie'][0].split(';')[0];
   response=await client.get('/student-test').set('Cookie',cookie); assert.equal(response.status,type==='employer'?403:200);
   response=await client.get('/employer-test').set('Cookie',cookie); assert.equal(response.status,403);
   if (verified.is_employer) {
    await User.approveEmployer(user.id);
    response=await post('/login',{email,password});
    const approvedCookie=response.headers['set-cookie'][0].split(';')[0];
    response=await client.get('/employer-test').set('Cookie',approvedCookie);
    assert.equal(response.status,200);
   }
   response=await post('/resend-verification',{email,password}); assert.equal(response.headers['location'],'/login');
   response=await post('/signup',data); assert.equal(response.headers['location'],'/signup');
  }
  const email='failure-'+suffix+'@example.com';
  shouldFail=true;
  const data={name:'Delivery failure test',email,password,confirmPassword:password,accountType:'employer'};
  let response=await post('/signup',data); assert.equal(response.headers['location'],'/resend-verification');
  const user=await User.findByEmail(email); ids.push(user.id); assert.equal(user.verification_sent_at,null);
  shouldFail=false;
  response=await post('/signup',data); assert.equal(response.status,200);
  assert.equal((await User.findByEmail(email)).id,user.id);
  response=await post('/signup',{name:'Invalid student',email:'normal@example.com',password,accountType:'student'});
  assert.equal(response.headers['location'],'/signup');
  assert.equal(await User.findByEmail('normal@example.com'),null);
  assert.equal(await User.markVerified('malformed'),null);
  response=await post('/verify-link',{verificationLink:'https://example.com/not-a-verification-link'});
  assert.equal(response.headers['location'],'/resend-verification');
  const { sendVerificationEmail } = require('../config/mailer');
  process.env.GMAIL_USER='';
  await assert.rejects(sendVerificationEmail(email,createVerification().token), {code:'EMAIL_CONFIG'});
  process.env.GMAIL_USER='test-sender@gmail.com';
  nodemailer.createTransport=()=>({sendMail:async()=>({accepted:[],rejected:[email]})});
  await assert.rejects(sendVerificationEmail(email,createVerification().token), {code:'EMAIL_REJECTED'});
 } finally {
  nodemailer.createTransport=savedTransport;
  for(const [key,value] of Object.entries({GMAIL_USER:savedEnv.user,GMAIL_APP_PASSWORD:savedEnv.password,APP_URL:savedEnv.url})) {
   if(value===undefined) delete process.env[key]; else process.env[key]=value;
  }
  if(ids.length) await db.none('DELETE FROM users WHERE id IN ($1:csv)',[ids]);
  await db.$pool.end();
 }
});
