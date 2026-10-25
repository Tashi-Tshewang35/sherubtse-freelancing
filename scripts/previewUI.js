// A database-free design preview using fictional fixtures. No real account data.
const express = require('express');
const path = require('path');
const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use(express.static(path.join(__dirname, '../public')));
Object.assign(app.locals, require('../config/viewHelpers'), { success: null, error: null, preview: true, csrfToken: 'preview-only' });
const date = (days, hour) => {
  const value = new Date(); value.setUTCDate(value.getUTCDate() + days); value.setUTCHours(hour - 6, 0, 0, 0); return value.toISOString();
};
const jobs = [
  { title: 'Weekend cafe assistant', work_type: 'Food Service', employer_name: 'Kanglung Community Cafe', location: 'Kanglung town', wage_rate: 120, wage_unit: 'hour', urgency: 'urgent' },
  { title: 'Help bring a campus event to life', work_type: 'Event Support', employer_name: 'Community Events', location: 'College campus', wage_rate: 850, wage_unit: 'day', urgency: 'normal' },
  { title: 'Share your maths skills', work_type: 'Tutoring', employer_name: 'Kanglung Learning Group', location: 'Lower Kanglung', wage_rate: 250, wage_unit: 'hour', urgency: 'normal' },
].map((job, i) => ({ ...job, id: i + 1, employer_id: 20, employer_status:'approved', created_at:date(-2,8), status: 'open', workers_needed: 2, start_at: date(i + 3, 10), end_at: date(i + 3, 16), application_opens_at: date(-2, 8), application_closes_at: date(2, 18), published_at: date(-2, 8), applicant_count: 3, accepted_count: 1, rejected_count: 1, completed_count: 1, description: 'Work with a friendly local team and develop your communication and organisation skills. Your schedule and responsibilities are agreed before work begins.', requirements: 'A reliable approach, clear communication and a willingness to learn.' }));
const profile = { id: 10, name: 'Pema Choden', email: '07240057.sherubtse@rub.edu.bt', student_number: '07240057', is_student: true, is_employer: false, is_verified: true, is_admin: false, employer_status: 'not_requested', availability_status: 'active', bio: 'A curious student who enjoys working with people and helping the community.', programme: 'BSc Computer Science', study_year: 'Year 2', contact: 'pema@example.com', preferred_hours: 'Weekends and weekday evenings', experience: 'Supported campus events and helped with a community learning programme.', skills: [{ id: 1, name: 'Food service', predefined: true }, { id: 2, name: 'Event assistance', predefined: true }], average_rating: 4.8, rating_count: 3, business_name: '', type_id: 1 };
const applications = jobs.map((job, i) => ({ ...job, id: i + 100, job_id: job.id, status: ['invited', 'accepted', 'completed'][i], created_at: date(-1, 9), decision_note: '' }));
const notifications = [{ id: 1, category: 'application', message: 'Weekend cafe assistant: you have been invited.', href: '/jobs/1', is_read: false, created_at: date(0, 8) }];
const ratings = [{ score: 5, comment: 'Reliable, thoughtful and a great addition to our team.', createdAt: date(-3, 10), jobId: 3 }];
app.use((req, res, next) => {
  const role = req.query.role || 'student';
  const current = { ...profile, is_student: role === 'student' || role === 'dual', is_employer: role === 'employer' || role === 'dual', is_admin: role === 'admin', employer_status: 'approved', business_name: 'Kanglung Community Cafe', location: 'Kanglung town', contact_number: '17000000', description: 'A community cafe near campus.', employer_type: 'Restaurant or cafe' };
  res.locals.user = ['/', '/login', '/signup', '/resend-verification', '/check-email', '/verified'].includes(req.path) ? null : { id: current.id, name: current.name, isStudent: current.is_student, isEmployer: current.is_employer, employerStatus: current.employer_status, isAdmin: current.is_admin };
  res.locals.title = 'Design preview'; res.locals.profile = current; next();
});
app.get('/', (req, res) => res.render('index', { jobs }));
app.get('/jobs', (req, res) => res.render('jobs/index', { jobs }));
app.get('/jobs/new', (req, res) => res.render('jobs/new', { draft: null }));
app.get('/jobs/:id/applicants', (req, res) => res.render('jobs/applicants', { job: jobs[0], applicants: applications.map((a, i) => ({ ...a, student_id: 10, name: ['Pema Choden', 'Sonam Wangmo', 'Karma Dorji'][i], email: profile.email, skills: 'Food service, Event assistance', programme: profile.programme, study_year: 'Year 2', schedule_availability: 'active', completed_count: 3, average_rating: 4.8, rating_count: 3, cover_note: 'I would love to help your team.', status: ['pending', 'accepted', 'completed'][i] })) }));
app.get('/jobs/:id', (req, res) => res.render('jobs/show', { job: jobs.find(j => j.id === Number(req.params.id)) || jobs[0], application: null, applicationsOpen: true, availableStudents: [] }));
app.get('/dashboard', (req, res) => res.render('dashboards/main', { mode:req.query.mode||'student',dualRole:req.query.role==='dual',recommendations:jobs,deadlines:jobs,studentApplications: applications, employerJobs: jobs, ratings, notifications }));
app.get('/profile', (req, res) => res.render('profiles/show', { own: true, applications, jobs, ratings, history: [], recruited: 3, skills: profile.skills, types: [{ id: 1, name: 'Restaurant or cafe' }, { id: 2, name: 'Other' }] }));
app.get('/notifications', (req, res) => res.render('notifications', { notifications }));
app.get('/admin', (req, res) => res.render('dashboards/admin', { statistics:{students:24,employers:8,completed:42},page:1,hasNext:false,reports:[],moderationJobs:jobs,moderationRatings:ratings.map((r,i)=>({...r,_id:String(i),employeeId:10})),auditRecords:[],applicationHistory:[],pendingEmployers: [{ id: 20, name: 'Kanglung Community Cafe', email: 'cafe@example.com', created_at: date(-1, 10) }], accounts: [profile], applications: applications.map(a => ({ ...a, student_id: 10, name: profile.name })), filters: { q: '', role: '', approval: '', status: '' } }));
app.get('/api/calendar', (req, res) => res.json(jobs.map((j, i) => ({ ...j, start: j.start_at, end: j.end_at, status: ['open', 'accepted', 'personal'][i], event_type: i === 2 ? 'personal' : 'work' }))));
for (const [slug,page] of Object.entries(require('../config/supportPages'))) app.get('/'+slug,(req,res)=>res.render('support/page',{page}));
app.get('/saved-jobs',(req,res)=>res.render('jobs/saved',{jobs}));
app.get('/reports',(req,res)=>res.render('support/reports',{reports:[],targetJob:'',targetUser:''}));
app.get('/reset-password/preview',(req,res)=>res.render('auth/reset-password',{token:'preview'}));
for (const page of ['login', 'signup', 'resend-verification','forgot-password']) app.get('/' + page, (req, res) => res.render('auth/' + page));
app.get('/check-email', (req, res) => res.render('auth/check-email', { email: profile.email }));
app.get('/verified', (req, res) => res.render('auth/verified', { verifiedUser: profile }));
app.get('/error', (req, res) => res.render('error', { message: 'This opportunity is not available to your account.' }));
app.use((req, res) => res.status(405).send('Design preview only. Forms do not save data.'));
if (require.main === module) app.listen(Number(process.env.PREVIEW_PORT || 3100), '127.0.0.1', () => console.log('Sample-data preview running with fictional data only.'));
module.exports = app;
