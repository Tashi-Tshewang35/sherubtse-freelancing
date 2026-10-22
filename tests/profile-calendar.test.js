const assert=require('node:assert/strict');const fs=require('fs');
const db=require('../config/db');const Profile=require('../models/Profile');const Job=require('../models/Job');const Application=require('../models/Application');const Calendar=require('../models/Calendar');
const {isOpen,canView,dateInput}=require('../config/workRules');
test('application boundaries, employer-only visibility and dual roles',()=>{
 const job={status:'open',published_at:new Date(),employer_id:1,application_opens_at:'2030-01-01T00:00:00Z',application_closes_at:'2030-01-02T00:00:00Z'};
 assert.equal(isOpen(job,new Date('2029-12-31')),false);assert.equal(isOpen(job,new Date(job.application_opens_at)),true);assert.equal(isOpen(job,new Date(job.application_closes_at)),false);
 assert.equal(canView({...job,application_opens_at:'2020-01-01',application_closes_at:'2099-01-01'},{id:2,isEmployer:true,isStudent:false}),false);
 assert.equal(canView({...job,application_opens_at:'2020-01-01',application_closes_at:'2099-01-01'},{id:2,isEmployer:true,isStudent:true}),true);
 assert.equal(dateInput('2030-01-01T12:00'),'2030-01-01T06:00:00.000Z');assert.equal(dateInput('garbage'),null);
});
test('PostgreSQL migration, profiles, skills, calendar, recruitment and status history (rolled back)',async()=>{
 const original={};const rollback=new Error('ROLLBACK_TEST');
 try{await db.tx(async t=>{
  await t.none(fs.readFileSync('database/profile_calendar_migration.sql','utf8').replace(/^BEGIN;/m,'').replace(/^COMMIT;/m,''));
  await t.none(fs.readFileSync('database/ui_workflow_migration.sql','utf8').replace(/^BEGIN;/m,'').replace(/^COMMIT;/m,''));
  for(const method of ['any','one','oneOrNone','none','result','tx']) {original[method]=db[method];db[method]=t[method].bind(t);}
  try{
   const seed=Date.now().toString();
   async function user(student,employer){return t.one(`INSERT INTO users(name,email,password_hash,is_student,is_employer,employer_status,is_verified) VALUES('Profile test',$1,'test',$2,$3,$4,true) RETURNING id`,[student?String(90000000+Math.floor(Math.random()*999999))+'.sherubtse@rub.edu.bt':seed+Math.random()+'@example.com',student,employer,employer?'approved':'not_requested']);}
   const employer=await user(false,true),student=await user(true,false),dual=await user(true,true),other=await user(false,true);
   const predefined=(await Profile.skills())[0];
   await Profile.saveStudent(student.id,{name:'Test student',bio:'Test bio',availability:'active',skillIds:[predefined.id],customSkills:['Custom test skill','custom TEST skill']});
   let p=await Profile.get(student.id);assert.equal(p.skills.length,2);assert.equal(p.bio,'Test bio');assert.equal(p.password_hash,undefined);
   await Profile.saveStudent(student.id,{name:'Edited student',bio:'Edited',availability:'inactive',skillIds:[],customSkills:['Edited skill']});
   p=await Profile.get(student.id);assert.equal(p.skills.length,1);assert.equal(p.skills[0].name,'Edited skill');
   await t.none("UPDATE users SET availability_status='active' WHERE id=$1",[student.id]);
   const type=(await Profile.types())[0];await Profile.saveEmployer(employer.id,{name:'Employer',businessName:'Test business',typeId:type.id,customType:null,description:'Business',location:'Kanglung',contactNumber:'12345678'});
   assert.equal((await Profile.get(employer.id)).business_name,'Test business');
   const now=Date.now();const data={title:'Test work',description:'Work',workType:'Cleaning',location:'Kanglung',wageRate:100,wageUnit:'hour',workersNeeded:2,startAt:new Date(now+86400000),endAt:new Date(now+90000000),urgency:'urgent',status:'open',opensAt:new Date(now-3600000),closesAt:new Date(now+7200000)};
   const job=await Job.createJob(employer.id,data),conflicting=await Job.createJob(employer.id,data);
   const future=await Job.createJob(employer.id,{...data,opensAt:new Date(now+3600000)});
   const closed=await Job.createJob(employer.id,{...data,opensAt:new Date(now-7200000),closesAt:new Date(now-3600000)});
   const draft=await Job.createJob(employer.id,{...data,status:'draft'});
   assert.equal(await Application.apply(future.id,student.id,''),null);assert.equal(await Application.apply(closed.id,student.id,''),null);assert.equal(await Application.apply(draft.id,student.id,''),null);assert.equal(await Application.apply(job.id,other.id,''),null);
   assert.equal((await Calendar.getEvents({id:other.id,isStudent:false,isEmployer:true})).length,0);
   let events=await Calendar.getEvents({id:dual.id,isStudent:true,isEmployer:true});assert.ok(events.some(e=>e.id===job.id));assert.ok(!events.some(e=>[future.id,closed.id,draft.id].includes(e.id)));
   assert.ok((await Calendar.getEvents({id:employer.id,isStudent:false,isEmployer:true})).some(e=>e.id===draft.id));
   const a=await Application.apply(job.id,student.id,'Hello');const b=await Application.apply(conflicting.id,student.id,'Conflict');
   const applicants=await Application.getJobApplicants(job.id,employer.id);assert.equal(applicants[0].skills,'Edited skill');assert.equal(Number(applicants[0].average_rating),0);
   await Application.accept(a.id,employer.id);assert.equal((await t.one('SELECT status FROM applications WHERE id=$1',[b.id])).status,'withdrawn');
   events=await Calendar.getEvents({id:student.id,isStudent:true,isEmployer:false});assert.equal(events.find(e=>e.id===job.id).status,'accepted');
   const next=await Application.apply(conflicting.id,dual.id,'');await assert.rejects(Application.directRecruit(conflicting.id,student.id,employer.id),/unavailable/);
   await Application.reject(next.id,employer.id);await Application.markCompleted(a.id,employer.id);
   assert.deepEqual((await t.any('SELECT status FROM application_status_history WHERE application_id=$1 ORDER BY id',[a.id])).map(h=>h.status),['pending','accepted','completed']);
   assert.equal(await Application.accept(a.id,other.id),null);
   assert.equal(await Job.updateDraft(draft.id,other.id,data),null);assert.ok(await Job.updateDraft(draft.id,employer.id,{...data,title:'Edited draft',status:'draft'}));assert.ok(await Job.publish(draft.id,employer.id));
   const admin=require('../controllers/adminController');
   for (const status of ['pending','accepted','rejected','withdrawn','completed']) {
    let page;
    await admin.dashboard({query:{q:'Edited student',status,role:'student'},session:{}},{render:(view,data)=>{page=data;}},error=>{throw error;});
    assert.ok(page.accounts.some(account=>account.id===student.id));
    assert.ok(page.applications.every(application=>application.status===status));
    assert.ok(page.accounts.every(account=>account.password_hash===undefined && account.verification_token===undefined));
   }
   let bothPage;
   await admin.dashboard({query:{role:'both',approval:'approved'},session:{}},{render:(view,data)=>{bothPage=data;}},error=>{throw error;});
   assert.ok(bothPage.accounts.some(account=>account.id===dual.id));
   assert.ok(bothPage.accounts.every(account=>account.is_student && account.is_employer));
   const authMiddleware=require('../middleware/auth');
   for(const gate of [authMiddleware.requireAdmin,authMiddleware.requireApprovedEmployer]) {
    let code;
    gate({session:{user:{id:student.id,isStudent:true}}},{status:value=>{code=value;return {render:()=>{}};}},()=>assert.fail('Unauthorized access'));
    assert.equal(code,403);
   }
   const profileController=require('../controllers/profileController');
   let denied;
   await profileController.show({params:{userId:student.id},session:{user:{id:other.id,isEmployer:true,employerStatus:'approved'}}},{status:code=>{denied=code;return {render:()=>{}};}},error=>{throw error;});
   assert.equal(denied,403);
   const request={session:{user:{id:other.id,isEmployer:true,employerStatus:'approved'}}};
   await t.none("UPDATE users SET employer_status='rejected' WHERE id=$1",[other.id]);
   await authMiddleware.refreshUser(request,{locals:{}},error=>{if(error)throw error;});
   assert.equal(request.session.user.employerStatus,'rejected');
   const ejs=require('ejs');
   const shared={...require('../config/viewHelpers'),title:'Test',user:{id:student.id,isStudent:true},success:null,error:null};
   await ejs.renderFile('views/profiles/show.ejs',{...shared,profile:await Profile.get(student.id),own:true,applications:await Application.getStudentApplications(student.id),jobs:[],ratings:[],history:[],recruited:0,skills:await Profile.skills(),types:await Profile.types()});
   await ejs.renderFile('views/jobs/new.ejs',{...shared,draft});
   await ejs.renderFile('views/dashboards/admin.ejs',{...shared,pendingEmployers:[],accounts:[],applications:[],filters:{q:'',role:'',approval:'',status:''}});
  }finally{for(const [method,value]of Object.entries(original))db[method]=value;}
  throw rollback;
 });}catch(e){if(e!==rollback)throw e;}finally{await db.$pool.end();}
});
