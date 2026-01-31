import axios from 'axios'
import type { CreateTaskInput, Task } from '../features/tasks/types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api',
  timeout: 5000,
  headers: {
    'Content-Type' : 'application/json'
  }
})

export const taskService = { 
  getAll: async () => {
    const response = await api.get('/tasks')
    return response.data;
  }, 
  getById: async (id: string) => {
    const response = await api.get(`tasks/${id}`)
    return response.data;
  }, 
  create: async (taskData: CreateTaskInput) => {
    const response = await api.post('/tasks', taskData)
    return response.data
  }, 
  update: async (id: string, taskData: Partial<Task>) => {
    const response = await api.patch(`/tasks/${id}`, taskData);
    return response.data;
  }, 
  delete: async (id: string) => {
    const response = await api.delete(`/tasks/${id}`);
    return response.data;
  } 
}

export default api