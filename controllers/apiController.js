const Calendar = require('../models/Calendar');

exports.getCalendar = async (req, res, next) => {
  try {
    const user={...req.session.user};
    if(user.isStudent && user.isEmployer && req.query.mode==='employer')user.isStudent=false;
    const events = await Calendar.getEvents(user);
    res.set('Cache-Control', 'no-store');
    res.json(events);
  } catch (error) { next(error); }
};

exports.addTask = async (req, res, next) => {
  try {
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const startAt = require('../config/workRules').dateInput(req.body.startAt);
    const endAt = require('../config/workRules').dateInput(req.body.endAt);
    if (!title || title.length > 120 || !startAt || !endAt || new Date(endAt) <= new Date(startAt)) {
      return res.status(400).json({ error: 'Valid title, start and end are required.' });
    }
    const task = await Calendar.addTask(req.session.user.id, title, startAt, endAt);
    res.status(201).json(task);
  } catch (error) { next(error); }
};

exports.deleteTask = async (req, res, next) => {
  try {
    await Calendar.deleteTask(req.params.id, req.session.user.id);
    res.status(204).send();
  } catch (error) { next(error); }
};
