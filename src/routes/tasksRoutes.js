const express = require('express');
const router = express.Router();
const tasksController = require('../controllers/tasksController');
const generate = require('../controllers/ai-generate');

router.post('/generate', generate.generateResponse);

// router.post('/request', tasksController.createRequest);
router.get('/tasks', tasksController.getTasks);
// router.get('/tasks/:id', tasksController.getTaskById);
// router.patch('/tasks/:id/status', tasksController.updateTaskStatus);

module.exports = router;
