const TaskService = require('../services/taskService');
const taskService = new TaskService();

const taskStore = null; // legacy placeholder; persistence is handled by taskService
/**
 * createTaskFromData
 * - Core task creation logic factored out so other routes (chat) can call it.
 * - Accepts already-determined `intent` and `entities` and returns the created task object.
 */
// Delegate persistence to taskService
async function createTaskFromData({ intent, entities, userContext = {}, userInput = '' }, userId = null) {
  // attach userId into userContext for ownership when provided
  if (userId) userContext = Object.assign({}, userContext, { userId });
  return taskService.createTaskFromData({ intent, entities, userContext, userInput });
}

exports.createRequest = async (req, res) => {
  const { userInput } = req.body;
  if (!userInput || typeof userInput !== 'string') {
    return res.status(400).json({ error: 'userInput is required' });
  }

  try {
    // attach current user id to userContext for ownership
    const userId = req.user && req.user.id ? req.user.id : null;
    const task = await taskService.createTaskFromInput(userInput, Object.assign({}, req.body.userContext || {}, { userId }));
    res.status(201).json(task);
  } catch (error) {
    console.error('createRequest failed', error);
    res.status(500).json({ error: 'Unable to create task' });
  }
};

// Export helper for other modules (chat route)
exports.createTaskFromData = createTaskFromData;

exports.getTasks = async (req, res) => {
  try {
    const userId = req.user && req.user.id ? req.user.id : null;
    const rows = await taskService.getAllTasks(userId);
    res.json(rows);
  } catch (err) {
    console.error('getTasks failed', err);
    res.status(500).json({ error: 'Unable to fetch tasks' });
  }
};

exports.getTaskById = async (req, res) => {
  const { id } = req.params;
  try {
    const userId = req.user && req.user.id ? req.user.id : null;
    const result = await taskService.getTaskById(id, userId);
    if (!result || !result.task) return res.status(404).json({ error: 'Task not found' });
    res.json(result);
  } catch (err) {
    console.error('getTaskById failed', err);
    res.status(500).json({ error: 'Unable to fetch task' });
  }
};

exports.updateTaskStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['Pending', 'In Progress', 'Completed'];

  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const userId = req.user && req.user.id ? req.user.id : null;
    const result = await taskService.updateTaskStatus(id, status, userId);
    res.json(result);
  } catch (err) {
    console.error('updateTaskStatus failed', err);
    if (err && err.code === 'not_found') return res.status(404).json({ error: 'Task not found' });
    res.status(500).json({ error: 'Unable to update status' });
  }
};