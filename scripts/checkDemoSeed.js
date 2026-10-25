require('../config/testEnvironment').loadTestEnvironment();
const fs=require('fs'),crypto=require('crypto'),assert=require('node:assert/strict');
const {spawnSync}=require('child_process');
const pgp=require('pg-promise')();
const {MongoClient}=require('mongodb');
async function main(){
 const source=process.env.DATABASE_URL?new URL(process.env.DATABASE_URL):null;
 const host=source?.hostname||process.env.DB_HOST;
 assert.ok(['localhost','127.0.0.1','[::1]'].includes(host),'Demo verification requires local services.');
 const mongoUrl=new URL(process.env.MONGODB_URI);assert.ok(['localhost','127.0.0.1','[::1]'].includes(mongoUrl.hostname));
 const name='sherubtse_seed_'+crypto.randomBytes(6).toString('hex')+'_demo';
 const adminUrl=source?new URL(source):null;if(adminUrl)adminUrl.pathname='/postgres';
 const connection=adminUrl?{connectionString:adminUrl.href}:{host,port:Number(process.env.DB_PORT),database:'postgres',user:process.env.DB_USER,password:process.env.DB_PASS};
 const admin=pgp(connection);let target,mongo,created=false;
 try{
  await admin.none('CREATE DATABASE $1:name',[name]);created=true;
  const targetUrl=source?new URL(source):null;if(targetUrl)targetUrl.pathname='/'+name;
  target=pgp(targetUrl?{connectionString:targetUrl.href}:{...connection,database:name});
  for(const file of ['database/postgresql_schema.sql','database/migrations/001_professional_upgrade.sql','database/migrations/002_security_and_trust.sql'])await target.none(fs.readFileSync(file,'utf8'));
  const env={...process.env,NODE_ENV:'development',DB_NAME:name,MONGODB_DB:name,ALLOW_DEMO_SEED:'true',DEMO_SEED_PASSWORD:crypto.randomBytes(24).toString('hex')};
  if(targetUrl)env.DATABASE_URL=targetUrl.href;
  for(let i=0;i<2;i++){
   const result=spawnSync(process.execPath,['scripts/seedDemo.js'],{env,windowsHide:true,encoding:'utf8',timeout:30000});
   assert.equal(result.status,0,'Demo seed execution failed; raw output withheld.');
  }
  const counts=await target.one(`SELECT (SELECT COUNT(*)::int FROM calendar_tasks) AS tasks, (SELECT COUNT(*)::int FROM users) AS users,(SELECT COUNT(*)::int FROM users WHERE is_admin) AS admins,(SELECT COUNT(*)::int FROM users WHERE is_student) AS students,(SELECT COUNT(*)::int FROM users WHERE is_employer AND NOT is_student) AS employers,(SELECT COUNT(*)::int FROM jobs) AS jobs,(SELECT COUNT(*)::int FROM applications) AS applications,(SELECT COUNT(*)::int FROM notifications) AS notifications`);
  assert.equal(counts.tasks,1);assert.equal(counts.users,7);assert.equal(counts.admins,1);assert.equal(counts.students,4);assert.equal(counts.employers,2);assert.equal(counts.jobs,5);assert.equal(counts.applications,5);assert.ok(counts.notifications>=10);
  assert.deepEqual((await target.any('SELECT status FROM applications ORDER BY id')).map(a=>a.status),['pending','accepted','rejected','in_progress','completed']);
  mongo=new MongoClient(process.env.MONGODB_URI);await mongo.connect();assert.equal(await mongo.db(name).collection('ratings').countDocuments(),1);
  console.log('PASS: demo seed ran twice against newly created isolated local databases; account/job/application/rating/calendar data is present and rerun is idempotent.');
 }finally{
  if(target)await target.$pool.end();
  // Only the uniquely named databases created by this verification are removed.
  if(created && /^sherubtse_seed_[a-f0-9]{12}_demo$/.test(name)){
   if(!mongo){mongo=new MongoClient(process.env.MONGODB_URI);await mongo.connect();}
   await mongo.db(name).dropDatabase();await admin.none('DROP DATABASE $1:name',[name]);
  }
  if(mongo)await mongo.close();await admin.$pool.end();
 }
}
main().catch(()=>{console.error('Demo verification failed; credentials and raw database errors withheld.');process.exitCode=1;});
