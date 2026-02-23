import axios from 'axios'
import type { CreateTaskInput, Task } from '../features/tasks/types';
import type { LoginUserInput, RegisterUserInput } from '../features/auth/types';

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
  timeSpent: number
}

export interface GetBacklogHealthResult {
  status: string;
  count: number;
}

export interface GetCategoryVolumeResult {
  category: string;
  completed: number;
  overdue: number;
  pending: number;
  total: number;
}

export interface OverdueDistribution {
  daysOverdue: string;
  count: number
}

export const statsService = {
  getProductivity: async (days: number = 30): Promise<GetProductivityResult[]> => {
    const response = await api.get(`/stats/productivity?days=${days}`) 
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
  },
  getOverdueDistribution: async () : Promise<OverdueDistribution[]> => {
    const response = await api.get("/stats/overduedistribution")
    return response.data;
  }
}

export interface ContactEnquiry {
  fullName: string;
  email: string;
  subject: string;
  message: string;
}

export const contactService = {
  sendEnquiry: async (enquiryData: ContactEnquiry) => {
    const response = await api.post('/contact', enquiryData);
    return response.data;
  }
}

interface AuthResult { token: string }

export const authService = {
  register: async (newUserData: RegisterUserInput): Promise<AuthResult> => {
    const response = await api.post("/auth/register", newUserData);
    return response.data
  },
  login: async (userData: LoginUserInput): Promise<AuthResult> => {
    const response = await api.post("/auth/login", userData);
    return response.data
  }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")

  if (token && config.headers){
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
},
error => Promise.reject(error)
)

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.reload()
    }
    return Promise.reject(error);
  }
);
export default api