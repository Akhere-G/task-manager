import axios from 'axios'
import type { CreateTaskInput, Task } from '../features/tasks/types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8080/api',
  timeout: 5000,
  headers: {
    'Content-Type' : 'application/json'
  }
})

export interface GetTaskResult {
    tasks: Task[];
    totalTasks: number;
    totalPages: number;
    currentPage: number;
}
interface DeleteTaskResult {
  id: string;
  message: string;
}

export const taskService = { 
  getAll: async (params?: URLSearchParams): Promise<GetTaskResult> => {
    const url = "/tasks" + (params ? `?${params.toString()}` : "")
    const response = await api.get(url)
    return response.data;
  }, 
  getById: async (id: number): Promise<Task> => {
    const response = await api.get(`tasks/${id}`)
    return response.data;
  }, 
  create: async (taskData: CreateTaskInput) => {
    const response = await api.post('/tasks', taskData)
    return response.data
  }, 
  update: async (id: number, taskData: Partial<Task>): Promise<Task> => {
    const response = await api.patch(`/tasks/${id}`, taskData);
    return response.data;
  }, 
  delete: async (id: number): Promise<DeleteTaskResult> => {
    const response = await api.delete(`/tasks/${id}`);
    return response.data;
  } 
}

export interface GetProductivityResult {
  date: string;
  tasks: number
}
export interface GetTimeSpentResult {
  category: string;
  time_spent: number
}

export interface GetBacklogHealthResult {
  status: string;
  count: number;
}

export interface GetCategoryVolumeResult {
  category: string;
  count: number;
}

export const statsService = {
  getProductivity: async (): Promise<GetProductivityResult[]> => {
    const response = await api.get("/stats/productivity")
    return response.data;
  },
  getTimeSpent: async (): Promise<GetTimeSpentResult[]> => {
    const response = await api.get("/stats/timespent");
    return response.data;
  },
  getBacklogHealth: async () : Promise<GetBacklogHealthResult[]> => {
    const response = await api.get("/stats/backloghealth")
    return response.data;
  },
  getCategoryVolume: async () : Promise<GetCategoryVolumeResult[]> => {
    const response = await api.get("/stats/categoryvolume")
    return response.data;
  }
}

export default api