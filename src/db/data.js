// /db/taskRepository.js

import { supabase } from './supabaseClient.js'

export class TaskRepository {
  async createTask(task) {
    const { data, error } = await supabase
      .from('tasks')
      .insert([task])
      .select()
      .single()

    if (error) throw error
    return data
  }

  async insertEntities(entities) {
    const { error } = await supabase
      .from('entities')
      .insert(entities)

    if (error) throw error
  }

  async insertSteps(steps) {
    const { error } = await supabase
      .from('task_steps')
      .insert(steps)

    if (error) throw error
  }

  async insertMessages(messages) {
    const { error } = await supabase
      .from('messages')
      .insert(messages)

    if (error) throw error
  }

  async getTasks() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return data
  }

  async getTaskById(taskId) {
    const [taskRes, entityRes, stepsRes, msgRes] = await Promise.all([
      supabase.from('tasks').select('*').eq('id', taskId).single(),
      supabase.from('entities').select('*').eq('task_id', taskId),
      supabase.from('task_steps').select('*').eq('task_id', taskId).order('step_order'),
      supabase.from('messages').select('*').eq('task_id', taskId),
    ])

    return {
      task: taskRes.data,
      entities: entityRes.data,
      steps: stepsRes.data,
      messages: msgRes.data
    }
  }
}