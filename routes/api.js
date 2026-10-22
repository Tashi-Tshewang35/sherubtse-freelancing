const express = require('express');
const router = express.Router();
const apiController = require('../controllers/apiController');
const { requireAuthApi } = require('../middleware/auth');

router.use(require('../middleware/auth').refreshUser);
router.get('/calendar', requireAuthApi, apiController.getCalendar);
router.post('/calendar/tasks', requireAuthApi, apiController.addTask);
router.delete('/calendar/tasks/:id', requireAuthApi, apiController.deleteTask);

module.exports = router;
