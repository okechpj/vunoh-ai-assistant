const { v4: uuidv4 } = require('uuid');
const AIService = require('../services/AIService');
const RiskEngine = require('../services/riskEngine');

const aiService = new AIService();
const riskEngine = new RiskEngine();
const taskStore = [];
const AssignmentService = require('../services/assignmentService');
const assignmentService = new AssignmentService();

exports.createRequest = async (req, res) => {
  const { userInput } = req.body;
  if (!userInput || typeof userInput !== 'string') {
    return res.status(400).json({ error: 'userInput is required' });
  }

  try {
    const extracted = await aiService.extractIntentEntities(userInput);
    const steps = await aiService.generateSteps(extracted.intent, extracted.entities);
    const task_code = `TASK-${Math.floor(1000 + Math.random() * 9000)}`;

    // compute risk using RiskEngine; include raw userInput so RiskEngine can parse when entities are incomplete
    const userContext = req.body.userContext || {};
    userContext.userInput = userInput;
    const risk = riskEngine.calculate(extracted.intent, extracted.entities, userContext);

    const messages = await aiService.generateMessages({
      task_code,
      intent: extracted.intent,
      entities: extracted.entities,
      risk_score: risk.risk_score
    });

      const assignment = assignmentService.assign(extracted.intent, extracted.entities);

      const task = {
      id: uuidv4(),
      task_code,
      intent: extracted.intent,
      entities: extracted.entities,
      risk_score: risk.risk_score,
      status: 'Pending',
        assigned_team: assignment.team,
        assigned_unit: assignment.unit,
      timestamp: new Date().toISOString(),
      steps,
      messages,
      risk_level: risk.risk_level,
      breakdown: risk.breakdown
    };

    taskStore.unshift(task);
    res.status(201).json(task);
  } catch (error) {
    console.error('createRequest failed', error);
    res.status(500).json({ error: 'Unable to create task' });
  }
};

exports.getTasks = (req, res) => {
  res.json(taskStore);
};

exports.getTaskById = (req, res) => {
  const { id } = req.params;
  const task = taskStore.find((item) => item.id === id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  res.json(task);
};

exports.updateTaskStatus = (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['Pending', 'In Progress', 'Completed'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const task = taskStore.find((item) => item.id === id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  task.status = status;
  res.json(task);
};