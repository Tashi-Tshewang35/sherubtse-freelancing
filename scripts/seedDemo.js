// Opt-in demonstration dataset; never imported by the server or migrations.
if(process.env.NODE_ENV==='production')throw new Error('Demo seeding is forbidden in production.');
const {isValidPassword}=require('../utils/validators');
function assertDemo(env){
  if(env.NODE_ENV!=='development'||env.ALLOW_DEMO_SEED!=='true'||!isValidPassword(env.DEMO_SEED_PASSWORD))throw new Error('Set NODE_ENV=development, ALLOW_DEMO_SEED=true and a strong DEMO_SEED_PASSWORD for the isolated demo database.');
  const url=env.DATABASE_URL?new URL(env.DATABASE_URL):null;
  const host=url?.hostname||env.DB_HOST||'localhost';
  const name=url?decodeURIComponent(url.pathname.slice(1)):env.DB_NAME;
  const mongo=new URL(env.MONGODB_URI||'mongodb://127.0.0.1:27017');
  if(!['localhost','127.0.0.1','[::1]'].includes(host)||!name?.endsWith('_demo')||!['localhost','127.0.0.1','[::1]'].includes(mongo.hostname)||!env.MONGODB_DB?.endsWith('_demo'))throw new Error('Demo seeding requires local PostgreSQL and MongoDB databases with names ending in _demo.');
}
async function main(){
  require('dotenv').config();
  assertDemo(process.env);
  const db=require('../config/db'),bcrypt=require('bcrypt'),mongo=require('../config/mongo');
  try{
    await require('../config/checkSchema').checkSchema();await mongo.connectMongo();
    const hash=await bcrypt.hash(process.env.DEMO_SEED_PASSWORD,12);
    await db.tx(async t=>{
      const marker=await t.oneOrNone("SELECT id FROM users WHERE email='demo-admin@example.invalid'");
      if(marker){console.log('Demo dataset already exists. No records changed.');return;}
      const accounts=[];
      const identities=[['Demo administrator','demo-admin@example.invalid',false,false,true],['Kanglung Community Cafe','demo-cafe@example.invalid',false,true,false],['Kanglung Learning Centre','demo-learning@example.invalid',false,true,false],['Pema Choden','99000001.sherubtse@rub.edu.bt',true,false,false],['Sonam Wangmo','99000002.sherubtse@rub.edu.bt',true,false,false],['Karma Dorji','99000003.sherubtse@rub.edu.bt',true,false,false],['Deki Yangzom','99000004.sherubtse@rub.edu.bt',true,true,false]];
      for(const [name,email,student,employer,admin]of identities)accounts.push(await t.one(`INSERT INTO users(name,email,password_hash,is_student,is_employer,is_admin,is_verified,employer_status) VALUES($1,$2,$3,$4,$5,$6,true,$7) RETURNING id`,[name,email,hash,student,employer,admin,employer?'approved':'not_requested']));
      const type=await t.one('SELECT id FROM employer_types ORDER BY id LIMIT 1');
      for(const i of [1,2,6])await t.none(`INSERT INTO employer_profiles(user_id,business_name,type_id,description,location,contact_number) VALUES($1,$2,$3,'Fictional development demonstration business.','Kanglung','Demo contact')`,[accounts[i].id,identities[i][0],type.id]);
      for(const i of [3,4,5,6]){
        await t.none("UPDATE student_profiles SET bio='Fictional student profile for development.',programme='BSc Computer Science',study_year='Year 2',preferred_hours='Weekends' WHERE user_id=$1",[accounts[i].id]);
        await t.none('INSERT INTO user_skills(user_id,skill_id) SELECT $1,id FROM skills WHERE predefined ORDER BY id LIMIT 3 ON CONFLICT DO NOTHING',[accounts[i].id]);
      }
      const titles=['Weekend cafe assistant','Campus event support','Community maths tutoring','Shop inventory assistant','Evening food service'];
      const statuses=['pending','accepted','rejected','in_progress','completed'];
      let completed;
      for(let i=0;i<5;i++){
        const day=i===4?-2:i+2;
        const start=new Date();start.setUTCDate(start.getUTCDate()+day);start.setUTCHours(4,0,0,0);
        const end=new Date(start.getTime()+3*3600000),close=new Date(start.getTime()-3600000),open=new Date(Math.min(Date.now()-86400000,close.getTime()-86400000));
        const job=await t.one(`INSERT INTO jobs(employer_id,title,description,work_type,location,wage_rate,wage_unit,workers_needed,start_at,end_at,urgency,status,application_opens_at,application_closes_at,published_at,requirements) VALUES($1,$2,'Fictional local work for development only. Agree wages directly.',$3,'Kanglung',150,'hour',2,$4,$5,$6,$7,$8,$9,NOW(),'Communication, reliability') RETURNING id`,[accounts[i%2+1].id,titles[i],i===2?'Tutoring':'Food Service',start,end,i===1?'urgent':'normal',i===4?'completed':'open',open,close]);
        const student=accounts[3+i%4].id;
        const application=await t.one(`INSERT INTO applications(job_id,student_id,status,completed_at) VALUES($1,$2,$3,CASE WHEN $3='completed' THEN NOW() ELSE NULL END) RETURNING id`,[job.id,student,statuses[i]]);
        if(['accepted','in_progress'].includes(statuses[i])){
          await t.none("UPDATE users SET availability_status='inactive' WHERE id=$1",[student]);
          await t.none("UPDATE student_profiles SET availability_before_work='active' WHERE user_id=$1",[student]);
        }
        if(i===4)completed={jobId:job.id,applicationId:application.id,employerId:accounts[i%2+1].id,employeeId:student};
      }
      await t.none("INSERT INTO calendar_tasks(user_id,title,start_at,end_at) VALUES($1,'Demo study session',NOW()+INTERVAL '1 day',NOW()+INTERVAL '25 hours')",[accounts[3].id]);
      // Mongo writes are idempotent and only target the isolated demo database.
      await mongo.getMongoDb().collection('ratings').updateOne({applicationId:completed.applicationId,employerId:completed.employerId},{$setOnInsert:{...completed,score:5,comment:'Reliable and helpful. Fictional demonstration review.',createdAt:new Date()}},{upsert:true});
      await t.none('INSERT INTO rating_summary(student_id,average_rating,rating_count) VALUES($1,5,1) ON CONFLICT(student_id) DO NOTHING',[completed.employeeId]);
      console.log('Demo dataset created: 1 administrator, 2 employers, 4 students (including a combined account), 5 jobs, applications, schedules, ratings and notifications. No passwords printed.');
    });
  }finally{await mongo.closeMongo();await db.$pool.end();}
}
if(require.main===module)main().catch(()=>{console.error('Demo seed failed safely. Check isolated demo configuration and migrations. No credentials printed.');process.exitCode=1;});
module.exports={assertDemo};
