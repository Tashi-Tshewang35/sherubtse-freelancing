const { isValidRating } = require('../utils/validators');
const db = require('../config/db');
const Rating = require('../models/Rating');

exports.create = async (req, res, next) => {
  try {
    const score = Number(req.body.score);
    if (!isValidRating(req.body.score)) {
      req.session.error = 'Rating must be between 1 and 5.';
      return res.redirect('/dashboard');
    }
    const work = await db.oneOrNone(
      `SELECT a.id, a.student_id, a.job_id FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE a.id = $1 AND j.employer_id = $2 AND a.status = 'completed'`,
      [req.params.applicationId, req.session.user.id]
    );
    if (!work) return res.status(403).render('error', { title: 'Rating Not Allowed', message: 'Only completed work can be rated.' });

    await Rating.createRating({
      jobId: work.job_id, applicationId: work.id, employerId: req.session.user.id,
      employeeId: work.student_id, score, comment: typeof req.body.comment === 'string' ? req.body.comment.trim().slice(0,500) : '',
    });
    req.session.success = 'Rating submitted.';
    res.redirect('/dashboard');
  } catch (error) {
    if (error.code === 11000) req.session.error = 'This work has already been rated.';
    else return next(error);
    res.redirect('/dashboard');
  }
};
