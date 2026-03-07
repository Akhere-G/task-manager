import axios from "axios";
import type { CreateTaskInput, Task } from "../features/tasks/types";
import type { LoginUserInput, RegisterUserInput } from "../features/auth/types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8080/api",
  headers: {
    "Content-Type": "application/json",
  },
});

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
    const url = "/tasks" + (params ? `?${params.toString()}` : "");
    const response = await api.get(url);
    return response.data;
  },
  getById: async (id: number): Promise<Task> => {
    const response = await api.get(`tasks/${id}`);
    return response.data;
  },
  create: async (taskData: CreateTaskInput) => {
    const response = await api.post("/tasks", taskData);
    return response.data;
  },
  createAll: async (tasksData: CreateTaskInput[]) => {
    const response = await api.post("/tasks/bulk", tasksData);
    return response.data;
  },
  update: async (id: number, taskData: Partial<Task>): Promise<Task> => {
    const response = await api.patch(`/tasks/${id}`, taskData);
    return response.data;
  },
  delete: async (id: number): Promise<DeleteTaskResult> => {
    const response = await api.delete(`/tasks/${id}`);
    return response.data;
  },
};

export interface ProductivityData {
  date: string;
  tasks: number;
}
export interface TimeSpentData {
  category: string;
  timeSpent: number;
}

export interface BacklogHealthData {
  status: string;
  count: number;
}

export interface CategoryVolumeData {
  category: string;
  completed: number;
  overdue: number;
  pending: number;
  total: number;
}

export interface OverdueDistributionData {
  daysOverdue: string;
  count: number;
}

export interface DeadlineProximityData {
  category: string;
  score: number;
}

export interface HourlyProductivityData {
  hour: number;
  count: number;
}

export interface Turnaround {
  count: number;
  daysTaken: number;
}

export interface EstimationAccuracy {
  id: number;
  title: string;
  category: string;
  estimatedAt: number;
  completedAt: number;
  varianceMinutes: number;
}

export interface WeekOverviewData {
  date: string;
  count: number;
}

export interface DistributionTrendData {
  date: string;
  chores: number;
  finance: number;
  general: number;
  health: number;
  hobbies: number;
  home: number;
  learning: number;
  "life-adim": number;
  "self-care": number;
  social: number;
  work: number;
}

export interface StatsResult {
  productivity: ProductivityData[];
  timeSpent: TimeSpentData[];
  backlogHealth: BacklogHealthData[];
  categoryVolume: CategoryVolumeData[];
  overdueDistribution: OverdueDistributionData[];
  deadlineProximity: DeadlineProximityData[];
  hourlyProductivity: HourlyProductivityData[];
  turnaround: Turnaround[];
  estimationAccuracy: EstimationAccuracy[];
  weekOverview: WeekOverviewData[];
  distributionTrend: DistributionTrendData[];
}
export const statsService = {
  getStats: async (): Promise<StatsResult> => {
    const response = await api.get("/stats/dashboard");
    return response.data;
  },
};

export interface ContactEnquiry {
  fullName: string;
  email: string;
  subject: string;
  message: string;
}

export const contactService = {
  sendEnquiry: async (enquiryData: ContactEnquiry) => {
    const response = await api.post("/contact", enquiryData);
    return response.data;
  },
};

interface AuthResult {
  token: string;
}

export const authService = {
  register: async (newUserData: RegisterUserInput): Promise<AuthResult> => {
    const response = await api.post("/auth/register", newUserData);
    return response.data;
  },
  login: async (userData: LoginUserInput): Promise<AuthResult> => {
    const response = await api.post("/auth/login", userData);
    return response.data;
  },
};

export interface DailyBrief {
  brief: string;
}

export interface DecomposeTaskResult {
  tasks: CreateTaskInput[];
}

export const aiService = {
  getDailyBrief: async (): Promise<DailyBrief> => {
    const response = await api.get("/ai/daily-brief");
    return response.data;
  },
  parseTask: async (text: string): Promise<CreateTaskInput> => {
    const response = await api.post("/ai/parse-task", { text });
    return response.data;
  },
  decomposeTask: async (
    task: CreateTaskInput,
  ): Promise<DecomposeTaskResult> => {
    const response = await api.post("ai/decompose", task);
    return response.data;
  },
};

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.reload();
    }
    return Promise.reject(error);
  },
);
export default api;
