const {filterJobs}=require('../../utils/jobSearch');
const {assertDemo}=require('../../scripts/seedDemo');
const jobs=[
 {id:1,title:'Cafe assistant',employer_name:'Local Cafe',work_type:'Food Service',requirements:'Communication',location:'Kanglung',urgency:'normal',wage_rate:100,created_at:'2030-01-01',application_closes_at:'2030-01-04',start_at:'2030-01-05T20:00:00Z'},
 {id:2,title:'Maths tutor',employer_name:'Learning Centre',work_type:'Tutoring',requirements:'Maths',location:'Campus',urgency:'urgent',wage_rate:250,created_at:'2030-01-02',application_closes_at:'2030-01-03',start_at:'2030-01-07T03:00:00Z'}
];
test('filters skills, location, work type, urgency and Bhutan work date',()=>{
 expect(filterJobs(jobs,{search:'communication',location:'kang',type:'Food Service',urgency:'normal',date:'2030-01-06'}).map(j=>j.id)).toEqual([1]);
 expect(filterJobs(jobs,{date:'2030-01-05'})).toEqual([]);
 expect(filterJobs(jobs,{search:{$ne:null}})).toHaveLength(2);
});
test.each(['newest','closing','wage','urgent'])('orders jobs by %s',sort=>expect(filterJobs(jobs,{sort}).map(j=>j.id)).toEqual([2,1]));
test('demo seed rejects production, remote hosts and ordinary databases before connecting',()=>{
 const safe={NODE_ENV:'development',ALLOW_DEMO_SEED:'true',DEMO_SEED_PASSWORD:'DemoTestPassword123!',DATABASE_URL:'postgresql://localhost/platform_demo',MONGODB_URI:'mongodb://127.0.0.1',MONGODB_DB:'platform_demo'};
 expect(()=>assertDemo(safe)).not.toThrow();
 for(const override of [{NODE_ENV:'production'},{ALLOW_DEMO_SEED:'false'},{DATABASE_URL:'postgresql://remote.example/platform_demo'},{DATABASE_URL:'postgresql://localhost/production'},{MONGODB_DB:'production'},{MONGO_URI:'mongodb://remote.example/platform_demo'}])expect(()=>assertDemo({...safe,...override})).toThrow();
});
