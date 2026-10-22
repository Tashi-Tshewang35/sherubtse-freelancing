const express = require('express');
const router = express.Router();

const authController = require('../controllers/authController');
const dashboardController = require('../controllers/dashboardController');
const jobController = require('../controllers/jobController');
const applicationController = require('../controllers/applicationController');
const ratingController = require('../controllers/ratingController');
const adminController = require('../controllers/adminController');
const { requireAuth, requireStudent, requireApprovedEmployer, requireAdmin } = require('../middleware/auth');

router.use(require('../middleware/auth').refreshUser);
router.get('/', dashboardController.home);

router.get('/signup', authController.showSignup);
router.post('/signup', authController.signup);
router.get('/verify/:token', authController.verifyEmail);
router.get('/resend-verification', authController.showResend);
router.post('/resend-verification', authController.resendVerification);
router.post('/verify-link', authController.verifyPastedLink);
router.get('/login', authController.showLogin);
router.post('/login', authController.login);
router.post('/logout', authController.logout);

const profileController=require('../controllers/profileController');
router.get('/profile',requireAuth,profileController.show);
router.get('/profiles/:userId',requireAuth,profileController.show);
router.post('/profile/student',requireStudent,profileController.saveStudent);
router.post('/profile/employer',requireAuth,profileController.saveEmployer);
router.post('/applications/:id/withdraw',requireStudent,applicationController.withdraw);
router.get('/jobs/:id/edit',requireApprovedEmployer,jobController.edit);
router.post('/jobs/:id/edit',requireApprovedEmployer,jobController.create);
router.post('/jobs/:id/cancel',requireApprovedEmployer,jobController.cancel);
router.post('/jobs/:id/publish',requireApprovedEmployer,jobController.publish);
router.get('/dashboard', requireAuth, dashboardController.dashboard);
router.post('/profile/availability', requireStudent, dashboardController.updateAvailability);

router.get('/jobs', jobController.list);
router.get('/jobs/new', requireApprovedEmployer, jobController.showCreate);
router.post('/jobs', requireApprovedEmployer, jobController.create);
router.get('/jobs/:id', jobController.show);
router.post('/jobs/:id/close', requireApprovedEmployer, jobController.close);
router.post('/jobs/:jobId/apply', requireStudent, applicationController.apply);
router.get('/jobs/:jobId/applicants', requireApprovedEmployer, applicationController.applicants);
router.post('/jobs/:jobId/recruit', requireApprovedEmployer, applicationController.directRecruit);

router.post('/applications/:id/accept', requireApprovedEmployer, applicationController.accept);
router.post('/applications/:id/reject', requireApprovedEmployer, applicationController.reject);
router.post('/applications/:id/complete', requireApprovedEmployer, applicationController.complete);
router.post('/applications/:applicationId/rate', requireApprovedEmployer, ratingController.create);

router.get('/admin', requireAdmin, adminController.dashboard);
router.post('/admin/employers/:userId/approve', requireAdmin, adminController.approveEmployer);
router.post('/admin/employers/:userId/reject', requireAdmin, adminController.rejectEmployer);

const notifications = require('../controllers/notificationController');
router.get('/notifications', requireAuth, notifications.index);
router.post('/notifications/read-all', requireAuth, notifications.read);
router.post('/notifications/:id/read', requireAuth, notifications.read);
router.post('/applications/:id/confirm', requireStudent, applicationController.confirm);
router.post('/applications/:id/decline', requireStudent, applicationController.decline);
router.post('/applications/:id/start', requireApprovedEmployer, applicationController.start);
module.exports = router;
