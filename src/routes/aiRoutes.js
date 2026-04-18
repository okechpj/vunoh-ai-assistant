const express = require('express');
const { v4: uuidv4 } = require('uuid');
const AIService = require('../services/AIService');
const tasksController = require('../controllers/tasksController');
const router = express.Router();
const ai = new AIService();

// In-memory conversation sessions (dev). Shape: { id, intent, entities, messages: [{role,msg}], completed }
const sessions = new Map();

// Required entities mapping controlled by backend logic
const REQUIRED_ENTITIES = {
  send_money: ['amount', 'recipient'],
  hire_service: ['service_type', 'location'],
  verify_document: ['document_type']
};

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


/**
 * POST /chat
 * Body: { sessionId?: string, message: string, userContext?: object }
 * Flow controlled by backend. AI only generates natural language follow-ups.
 */
async function chatHandler(req, res) {
  const { sessionId, message, userContext } = req.body;
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message is required' });

  // Initialize or fetch session
  let session = null;
  if (sessionId) session = sessions.get(sessionId) || null;
  if (!session) {
    const id = uuidv4();
    session = { id, intent: null, entities: {}, messages: [], completed: false };
    sessions.set(id, session);
  }

  // Append user message
  session.messages.push({ role: 'user', text: message, ts: new Date().toISOString() });

  try {
    // Ask AI to extract intent/entities from this message
    const extracted = await ai.extractIntentEntities(message);

    // If session has no intent yet, set it when AI returns a valid one
    if (!session.intent && extracted.intent && extracted.intent !== 'unknown') {
      session.intent = extracted.intent;
    }

    // Merge entities: prefer new non-null values
    const merged = Object.assign({}, session.entities || {});
    Object.keys(extracted.entities || {}).forEach(k => {
      if (extracted.entities[k] !== null && extracted.entities[k] !== undefined) merged[k] = extracted.entities[k];
    });
    session.entities = merged;

    // Determine required fields based on intent
    const intentKey = session.intent || extracted.intent || 'unknown';
    const required = REQUIRED_ENTITIES[intentKey] || [];
    const missing = required.filter(k => !(session.entities && session.entities[k] !== null && session.entities[k] !== undefined));

    if (missing.length > 0) {
      // Generate follow-up question text only
      const follow = await ai.generateFollowUpQuestion(intentKey, missing, session.entities || {});
      session.messages.push({ role: 'assistant', text: follow, ts: new Date().toISOString() });
      sessions.set(session.id, session);
      return res.json({ sessionId: session.id, type: 'followup', message: follow, missingEntities: missing });
    }

    // All required entities present -> create task via tasksController helper
    const created = await tasksController.createTaskFromData({ intent: intentKey, entities: session.entities, userContext: userContext || {}, userInput: message });

    const confirmText = `Thank you for the information. Your request (${created.task_code}) has been created. Please check your dashboard for details.`;
    session.messages.push({ role: 'assistant', text: confirmText, ts: new Date().toISOString() });
    session.completed = true;
    sessions.set(session.id, session);

    return res.json({ sessionId: session.id, type: 'complete', message: confirmText, task: created });
  } catch (err) {
    console.error('chat flow error', err);
    return res.status(500).json({ error: 'internal_error' });
  }
}

router.post('/chat', chatHandler);

// export handler so it can be mounted at alternative paths (e.g. /api/chat)
module.exports = router;
module.exports.chatHandler = chatHandler;

module.exports = router;