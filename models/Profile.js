const db = require('../config/db');
async function get(userId) {
 const user = await db.oneOrNone(`SELECT u.id,u.name,u.email,u.is_student,u.is_employer,u.is_admin,u.is_verified,u.employer_status,u.availability_status,u.created_at,
 sp.student_number,sp.bio,sp.programme,sp.study_year,sp.contact,sp.experience,sp.preferred_hours,ep.business_name,ep.type_id,ep.custom_type,ep.description,ep.location,ep.contact_number,et.name AS employer_type,
 COALESCE(rs.average_rating,0) AS average_rating,COALESCE(rs.rating_count,0) AS rating_count
 FROM users u LEFT JOIN student_profiles sp ON sp.user_id=u.id LEFT JOIN employer_profiles ep ON ep.user_id=u.id
 LEFT JOIN employer_types et ON et.id=ep.type_id LEFT JOIN rating_summary rs ON rs.student_id=u.id WHERE u.id=$1`,[userId]);
 if (!user) return null;
 user.skills = await db.any('SELECT s.* FROM user_skills us JOIN skills s ON s.id=us.skill_id WHERE us.user_id=$1 ORDER BY s.name',[userId]);
 return user;
}
async function saveStudent(userId,data) {
 return db.tx(async t=>{
  await t.one('SELECT id FROM users WHERE id=$1 FOR UPDATE',[userId]);
  const busy=await t.oneOrNone("SELECT id FROM applications WHERE student_id=$1 AND status IN ('accepted','in_progress') LIMIT 1",[userId]);
  if(busy) {
   await t.none('UPDATE student_profiles SET availability_before_work=$2 WHERE user_id=$1',[userId,data.availability]);
   data={...data,availability:'inactive'};
  }
  await t.none('UPDATE student_profiles sp SET availability_before_work=NULL FROM users u WHERE sp.user_id=u.id AND u.id=$1 AND u.availability_status<>$2',[userId,data.availability]);
  await t.none('UPDATE users SET name=$2,availability_status=$3 WHERE id=$1 AND is_student=true',[userId,data.name,data.availability]);
  await t.none(`INSERT INTO student_profiles(user_id,student_number,bio) SELECT id,substring(email,1,8),$2 FROM users WHERE id=$1 AND is_student
   ON CONFLICT(user_id) DO UPDATE SET bio=EXCLUDED.bio,updated_at=NOW()`,[userId,data.bio]);
  await t.none('UPDATE student_profiles SET programme=$2,study_year=$3,contact=$4,experience=$5,preferred_hours=$6 WHERE user_id=$1', [userId,data.programme || '',data.studyYear || '',data.contact || '',data.experience || '',data.preferredHours || '']);
  await t.none('DELETE FROM user_skills WHERE user_id=$1',[userId]);
  for (const id of data.skillIds) await t.none(`INSERT INTO user_skills(user_id,skill_id) SELECT $1,id FROM skills WHERE id=$2 AND predefined ON CONFLICT DO NOTHING`,[userId,id]);
  for (const name of data.customSkills) {
   const skill=await t.one(`INSERT INTO skills(name) VALUES($1) ON CONFLICT(lower(name)) DO UPDATE SET name=skills.name RETURNING id`,[name]);
   await t.none('INSERT INTO user_skills(user_id,skill_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[userId,skill.id]);
  }
 });
}
async function saveEmployer(userId,data) {
 return db.tx(async t=>{
  await t.none('UPDATE users SET name=$2 WHERE id=$1 AND is_employer',[userId,data.name]);
  await t.none(`INSERT INTO employer_profiles(user_id,business_name,type_id,custom_type,description,location,contact_number)
  VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(user_id) DO UPDATE SET business_name=EXCLUDED.business_name,type_id=EXCLUDED.type_id,
  custom_type=EXCLUDED.custom_type,description=EXCLUDED.description,location=EXCLUDED.location,contact_number=EXCLUDED.contact_number,updated_at=NOW()`,
  [userId,data.businessName,data.typeId,data.customType,data.description,data.location,data.contactNumber]);
 });
}
module.exports={get,saveStudent,saveEmployer,
 skills:()=>db.any('SELECT * FROM skills WHERE predefined ORDER BY name'),types:()=>db.any('SELECT * FROM employer_types ORDER BY id')};
