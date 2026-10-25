const Saved = require('../models/SavedJob');
exports.list = async (req, res, next) => {
  try { res.render('jobs/saved', { title: 'Saved jobs', jobs: await Saved.list(req.session.user.id) }); }
  catch (error) { next(error); }
};
exports.update = async (req, res, next) => {
  try {
    await Saved[req.body.action === 'remove' ? 'remove' : 'save'](req.session.user.id, req.params.id);
    req.session.success = req.body.action === 'remove' ? 'Job removed from saved jobs.' : 'Job saved if it is still available.';
    res.redirect('/saved-jobs');
  } catch (error) { next(error); }
};
