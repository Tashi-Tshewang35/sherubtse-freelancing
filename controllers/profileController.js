const Profile=require('../models/Profile');
const Application=require('../models/Application');
const Job=require('../models/Job');
const Rating=require('../models/Rating');
const db=require('../config/db');
exports.show=async(req,res,next)=>{
 try {
  const id=req.params.userId || req.session.user.id;
  const own=Number(id)===req.session.user.id;
  if (!own && !req.session.user.isAdmin) {
   const permission=req.session.user.isEmployer && req.session.user.employerStatus==='approved' && await db.oneOrNone(
    'SELECT a.id FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.student_id=$1 AND j.employer_id=$2 LIMIT 1',[id,req.session.user.id]);
   if(!permission) return res.status(403).render('error',{title:'Access denied',message:'You may view only your applicants.'});
  }
  const profile=await Profile.get(id);
  if(!profile) return res.status(404).render('error',{title:'Not found',message:'Account not found.'});
  let applications=profile.is_student ? await Application.getStudentApplications(id):[];
  const privateAccess=own || req.session.user.isAdmin;
  if(!privateAccess) applications=applications.filter(a=>a.employer_id===req.session.user.id);
  const jobs=profile.is_employer && privateAccess ? await Job.getByEmployer(id):[];
  const ratings=profile.is_student ? await Rating.getEmployeeRatings(id):[];
  const rated=new Set(ratings.map(r=>Number(r.applicationId)));applications.forEach(a=>{a.rated=rated.has(a.id);});
  const history=await db.any(`SELECT h.*,a.job_id,j.title FROM application_status_history h JOIN applications a ON a.id=h.application_id JOIN jobs j ON j.id=a.job_id WHERE a.student_id=$1 AND ($2 OR j.employer_id=$3) ORDER BY h.changed_at`,[id,privateAccess,req.session.user.id]);
  const recruited=await db.one(`SELECT COUNT(*)::int AS count FROM applications a JOIN jobs j ON j.id=a.job_id WHERE j.employer_id=$1 AND a.status IN ('accepted','in_progress','completed')`,[id]);
  res.render('profiles/show',{title:'Account profile',profile,own,applications,jobs,ratings,history,recruited:recruited.count,skills:await Profile.skills(),types:await Profile.types()});
 }catch(e){next(e);}
};
function text(value,max,required=false){
 if(typeof value!=='string' || value.trim().length>max || (required&&!value.trim())) throw new Error('Please check the required fields and text lengths.');
 return value.trim();
}
exports.saveStudent=async(req,res,next)=>{
 try{
  const skillIds=[...new Set([].concat(req.body.skills||[]).map(Number))];
  if(skillIds.some(id=>!Number.isInteger(id)||id<1)||skillIds.length>30) throw new Error('Choose valid skills.');
  const customSkills=[...new Map(text(req.body.customSkills||'',1000).split('\n').map(s=>s.trim()).filter(Boolean).map(s=>[s.toLowerCase(),s])).values()];
  if(customSkills.some(s=>s.length>80)||customSkills.length>20) throw new Error('Use at most 20 custom skills, each up to 80 characters.');
  if(!['active','inactive'].includes(req.body.availability)) throw new Error('Choose a valid availability.');
  await Profile.saveStudent(req.session.user.id,{name:text(req.body.name,100,true),bio:text(req.body.bio||'',1000),availability:req.body.availability,skillIds,customSkills,programme:text(req.body.programme||'',120),studyYear:text(req.body.studyYear||'',30),contact:text(req.body.contact||'',100),experience:text(req.body.experience||'',1500),preferredHours:text(req.body.preferredHours||'',250)});
  req.session.success='Student profile and skills updated.';
 }catch(e){if(e.code)return next(e);req.session.error=e.message;} res.redirect('/profile');
};
exports.saveEmployer=async(req,res,next)=>{
 try{
  if(!req.session.user.isEmployer)return res.status(403).render('error',{title:'Access denied',message:'Employer registration required.'});
  const types=await Profile.types();const type=types.find(t=>t.id===Number(req.body.typeId));
  if(!type)throw new Error('Choose an employer type.');
  await Profile.saveEmployer(req.session.user.id,{name:text(req.body.name,100,true),businessName:text(req.body.businessName,150,true),typeId:type.id,
  customType:type.name==='Other'?text(req.body.customType,80,true):null,description:text(req.body.description||'',1000),location:text(req.body.location,150,true),contactNumber:text(req.body.contactNumber,30,true)});
  req.session.success='Employer profile updated.';
 }catch(e){if(e.code)return next(e);req.session.error=e.message;}res.redirect('/profile');
};
