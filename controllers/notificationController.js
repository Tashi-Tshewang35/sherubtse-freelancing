const Notification = require('../models/Notification');
exports.index = async (req, res, next) => {
  try { res.render('notifications', { title: 'Notifications', notifications: await Notification.list(req.session.user.id) }); }
  catch (error) { next(error); }
};
exports.read = async (req, res, next) => {
  try {
    if (req.params.id && !/^\d+$/.test(req.params.id)) return res.status(400).render('error', { message: 'Choose a valid notification.' });
    await Notification.read(req.session.user.id, req.params.id);
    res.redirect('/notifications');
  } catch (error) { next(error); }
};
