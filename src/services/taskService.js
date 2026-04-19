const { v4: uuidv4 } = require('uuid');
const TaskRepository = require('../db/taskRepository');
const AIService = require('./AIService');
const RiskEngine = require('./riskEngine');
const AssignmentService = require('./assignmentService');

const repo = new TaskRepository();
const ai = new AIService();
const riskEngine = new RiskEngine();
const assignmentService = new AssignmentService();

class TaskService {
  constructor() {}

  async createTaskFromData({ intent, entities, userContext = {}, userInput = '' }) {
    // Generate all derived data (steps, messages, risk, assignment)
    if (!intent) throw new Error('intent_required');

    const task_code = `TASK-${Math.floor(1000 + Math.random() * 9000)}`;
    const risk = riskEngine.calculate(intent, entities, Object.assign({}, userContext, { userInput }));
    const assignment = assignmentService.assign(intent, entities);
    const steps = await ai.generateSteps(intent, entities);
    const messages = await ai.generateMessages({ task_code, intent, entities, risk_score: risk.risk_score });

    // Prepare DB rows
    const taskId = uuidv4();
    // tasks table per spec: risk_score integer not null, risk_level not null, assigned_team not null
    const taskRow = {
      id: taskId,
      task_code,
      intent,
      status: 'Pending',
      // store integer risk score
      risk_score: Math.round(Number(risk.risk_score || 0)),
      risk_level: risk.risk_level || 'medium',
      assigned_team: assignment.team || 'Unassigned',
      assigned_unit: assignment.unit || null,
      created_at: new Date().toISOString()
    };

    // Entities table uses `entity_type` and `value`
    const entityRows = Object.keys(entities || {}).map(k => ({ id: uuidv4(), task_id: taskId, entity_type: k, value: entities[k] == null ? null : String(entities[k]), created_at: new Date().toISOString() }));

    // Also persist risk breakdown as an entity (so we keep breakdown info without altering tasks schema)
    if (risk && risk.breakdown) {
      entityRows.push({ id: uuidv4(), task_id: taskId, entity_type: 'risk_breakdown', value: JSON.stringify(risk.breakdown), created_at: new Date().toISOString() });
    }

    const stepRows = (steps || []).map((s, i) => ({ id: uuidv4(), task_id: taskId, step_order: i + 1, description: s }));

    // messages table expects `type` column (whatsapp,email,sms)
    const messageRows = [
      { id: uuidv4(), task_id: taskId, type: 'whatsapp', content: messages.whatsapp, created_at: new Date().toISOString() },
      { id: uuidv4(), task_id: taskId, type: 'email', content: messages.email, created_at: new Date().toISOString() },
      { id: uuidv4(), task_id: taskId, type: 'sms', content: messages.sms, created_at: new Date().toISOString() }
    ];

    const statusHistoryRow = { id: uuidv4(), task_id: taskId, old_status: null, new_status: 'Pending', changed_at: new Date().toISOString() };

    // Persist with manual rollback on failure to avoid partial writes
    try {
      const createdTask = await repo.createTask(taskRow);
      await repo.insertEntities(entityRows);
      await repo.insertSteps(stepRows);
      await repo.insertMessages(messageRows);
      await repo.insertStatusHistory(statusHistoryRow);

      // Return structured result
      return {
        ...createdTask,
        entities: entityRows,
        steps: stepRows,
        messages: messageRows,
        status_history: [statusHistoryRow]
      };
    } catch (err) {
      console.error('createTaskFromData failed, attempting cleanup', err);
      // Attempt cleanup: delete partial rows by task_id
      try { await repo.updateTaskStatus(taskId, 'Failed'); } catch (e) { /* ignore */ }
      // Note: more robust rollback would run in DB transaction; here we mark Failure and surface error
      throw err;
    }
  }

  async createTaskFromInput(userInput, userContext = {}) {
    // Use AI to extract intent/entities then delegate to createTaskFromData
    const extracted = await ai.extractIntentEntities(userInput);
    const intent = extracted.intent;
    const entities = extracted.entities || {};
    return this.createTaskFromData({ intent, entities, userInput, userContext });
  }

  async getAllTasks() {
    return repo.getAllTasks();
  }

  async getTaskById(taskId) {
    return repo.getTaskById(taskId);
  }

  async updateTaskStatus(taskId, newStatus) {
    // Fetch current status
    const current = await repo.getTaskById(taskId);
    const oldStatus = current.task.status;
    const updated = await repo.updateTaskStatus(taskId, newStatus);
    const historyRow = { id: uuidv4(), task_id: taskId, old_status: oldStatus, new_status: newStatus, changed_at: new Date().toISOString() };
    await repo.insertStatusHistory(historyRow);
    return { updated, history: historyRow };
  }
}

module.exports = TaskService;
