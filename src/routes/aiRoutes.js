const express = require('express');
const AIService = require('../services/AIService');
const router = express.Router();
const ai = new AIService();

router.post('/extract', async (req, res) => {
  const { userInput } = req.body;
  res.json(await ai.extractIntentEntities(userInput));
});

router.post('/steps', async (req, res) => {
  const { intent, entities } = req.body;
  res.json(await ai.generateSteps(intent, entities));
});

router.post('/messages', async (req, res) => {
  const taskData = req.body;
  res.json(await ai.generateMessages(taskData));
});

module.exports = router;