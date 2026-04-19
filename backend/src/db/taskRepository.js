const { supabase } = require('./supabaseClient');
const { v4: uuidv4 } = require('uuid');

class TaskRepository {
  constructor() {}

  async createTask(task) {
    // task should be an object with required fields
    let payload = Object.assign({}, task);
    try {
      const { data, error } = await supabase.from('tasks').insert([payload]).select().single();
      if (error) {
        console.error('createTask error', error);
        throw error;
      }
      return data;
    } catch (err) {
      // Handle supabase/schema cache errors where a column is missing in the DB (PGRST204)
      try {
        const msg = err && err.message ? String(err.message) : '';
        const m = msg.match(/Could not find the '([a-zA-Z0-9_]+)' column/);
        if (m && m[1]) {
          const col = m[1];
          console.warn(`createTask: detected missing column '${col}' in DB schema; retrying without that field.`);
          // remove that key from payload and retry
          payload = Object.assign({}, payload);
          if (payload.hasOwnProperty(col)) delete payload[col];
          const { data: d2, error: e2 } = await supabase.from('tasks').insert([payload]).select().single();
          if (e2) {
            console.error('createTask retry failed', e2);
            throw e2;
          }
          return d2;
        }
        // Handle unique constraint on created_by (some DBs may have accidentally created a unique index)
        if (err && err.code === '23505' && String(err.message).includes('created_by')) {
          console.warn('createTask: unique constraint on created_by detected; retrying without created_by');
          payload = Object.assign({}, payload);
          if (payload.hasOwnProperty('created_by')) delete payload['created_by'];
          const { data: d3, error: e3 } = await supabase.from('tasks').insert([payload]).select().single();
          if (e3) {
            console.error('createTask retry without created_by failed', e3);
            throw e3;
          }
          return d3;
        }
      } catch (retryErr) {
        console.error('createTask retry error', retryErr);
        // fallthrough to rethrow original
      }

      throw err;
    }
  }

  async insertEntities(entities) {
    if (!Array.isArray(entities) || entities.length === 0) return [];
    const rows = entities.map(e => Object.assign({}, e));
    const { data, error } = await supabase.from('entities').insert(rows).select();
    if (error) {
      console.error('insertEntities error', error);
      throw error;
    }
    return data;
  }

  async insertSteps(steps) {
    if (!Array.isArray(steps) || steps.length === 0) return [];
    const rows = steps.map(s => Object.assign({}, s));
    const { data, error } = await supabase.from('task_steps').insert(rows).select();
    if (error) {
      console.error('insertSteps error', error);
      throw error;
    }
    return data;
  }

  async insertMessages(messages) {
    if (!Array.isArray(messages) || messages.length === 0) return [];
    const rows = messages.map(m => Object.assign({}, m));
    const { data, error } = await supabase.from('messages').insert(rows).select();
    if (error) {
      console.error('insertMessages error', error);
      throw error;
    }
    return data;
  }

  async insertStatusHistory(historyRow) {
    const row = Object.assign({}, historyRow);
    const { data, error } = await supabase.from('status_history').insert([row]).select().single();
    if (error) {
      console.error('insertStatusHistory error', error);
      throw error;
    }
    return data;
  }

  async getAllTasks(userId) {
    // Return lightweight rows for dashboard; if userId provided, filter by creator
    let query = supabase
      .from('tasks')
      .select('id,task_code,intent,risk_score,risk_level,status,assigned_team,assigned_unit,created_at')
      .order('created_at', { ascending: false });
    if (userId) query = query.eq('created_by', userId);
    const { data, error } = await query;
    if (error) {
      console.error('getAllTasks error', error);
      throw error;
    }
    return data;
  }

  async getTaskById(taskId, userId) {
    // When userId provided, apply ownership filter to task fetch
    const taskQuery = userId ? supabase.from('tasks').select('*').eq('id', taskId).eq('created_by', userId).single() : supabase.from('tasks').select('*').eq('id', taskId).single();
    const [taskRes, entityRes, stepsRes, msgRes, historyRes] = await Promise.all([
      taskQuery,
      supabase.from('entities').select('*').eq('task_id', taskId),
      supabase.from('task_steps').select('*').eq('task_id', taskId).order('step_order', { ascending: true }),
      supabase.from('messages').select('*').eq('task_id', taskId),
      supabase.from('status_history').select('*').eq('task_id', taskId).order('changed_at', { ascending: true })
    ]);

    if (taskRes.error) throw taskRes.error;
    if (entityRes.error) throw entityRes.error;
    if (stepsRes.error) throw stepsRes.error;
    if (msgRes.error) throw msgRes.error;
    if (historyRes.error) throw historyRes.error;

    return {
      task: taskRes.data,
      entities: entityRes.data,
      steps: stepsRes.data,
      messages: msgRes.data,
      status_history: historyRes.data
    };
  }

  async updateTaskStatus(taskId, newStatus, userId) {
    // Update tasks.status and return updated row
    let query = supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    if (userId) query = query.eq('created_by', userId);
    const { data, error } = await query.select().single();
    if (error) {
      console.error('updateTaskStatus error', error);
      // If PostgREST returns PGRST116 it means zero rows; normalize to not_found
      if (error.code === 'PGRST116') {
        const e = new Error('not_found');
        e.code = 'not_found';
        throw e;
      }
      throw error;
    }
    if (!data) {
      const e = new Error('not_found');
      e.code = 'not_found';
      throw e;
    }
    return data;
  }
}

module.exports = TaskRepository;
