const supabase = require('./supabase');

const TaskRepository = {
  // --- Tasks ---
  async createTask(taskData) {
    const { data, error } = await supabase
      .from('tasks')
      .insert([taskData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async getTaskById(taskId) {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
      
    if (error) throw error;
    return data;
  },

  async updateTaskStatus(taskId, status) {
    const { data, error } = await supabase
      .from('tasks')
      .update({ status })
      .eq('id', taskId)
      .select()
      .single();
      
    if (error) throw error;
    return data;
  },

  // --- Entities ---
  async addEntities(entitiesData) {
    // entitiesData should be an array of { task_id, entity_type, value }
    const { data, error } = await supabase
      .from('entities')
      .insert(entitiesData)
      .select();
      
    if (error) throw error;
    return data;
  },

  async getEntitiesByTaskId(taskId) {
    const { data, error } = await supabase
      .from('entities')
      .select('*')
      .eq('task_id', taskId);
      
    if (error) throw error;
    return data;
  },

  // --- Task Steps ---
  async addTaskSteps(stepsData) {
    // stepsData -> array of { task_id, step_order, description }
    const { data, error } = await supabase
      .from('task_steps')
      .insert(stepsData)
      .select();
      
    if (error) throw error;
    return data;
  },

  async getStepsByTaskId(taskId) {
    const { data, error } = await supabase
      .from('task_steps')
      .select('*')
      .eq('task_id', taskId)
      .order('step_order', { ascending: true });
      
    if (error) throw error;
    return data;
  },

  // --- Messages ---
  async addMessages(messagesData) {
    // messagesData -> array of { task_id, type, content }
    const { data, error } = await supabase
      .from('messages')
      .insert(messagesData)
      .select();
      
    if (error) throw error;
    return data;
  },

  async getMessagesByTaskId(taskId) {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('task_id', taskId);
      
    if (error) throw error;
    return data;
  }
};

module.exports = TaskRepository;
