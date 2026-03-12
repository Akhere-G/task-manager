import axios from "axios";
import type { CreateTaskInput, Task } from "../features/tasks/types";
import type {
  LoginUserInput,
  RegisterUserInput,
  User,
} from "../features/auth/types";
import Cookies from "js-cookie";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://127.0.0.1:8080/api",
  withCredentials: true,
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
    const response = await apiClient.get(url);
    return response.data;
  },
  getById: async (id: number): Promise<Task> => {
    const response = await apiClient.get(`tasks/${id}`);
    return response.data;
  },
  create: async (taskData: CreateTaskInput) => {
    const response = await apiClient.post("/tasks", taskData);
    return response.data;
  },
  createAll: async (tasksData: CreateTaskInput[]) => {
    const response = await apiClient.post("/tasks/bulk", tasksData);
    return response.data;
  },
  update: async (id: number, taskData: Partial<Task>): Promise<Task> => {
    const response = await apiClient.patch(`/tasks/${id}`, taskData);
    return response.data;
  },
  delete: async (id: number): Promise<DeleteTaskResult> => {
    const response = await apiClient.delete(`/tasks/${id}`);
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
    const response = await apiClient.get("/stats/dashboard");
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
    const response = await apiClient.post("/contact", enquiryData);
    return response.data;
  },
};

interface AuthResult {
  user: User;
  message: string;
}

export const authService = {
  register: async (newUserData: RegisterUserInput): Promise<AuthResult> => {
    const response = await apiClient.post("/auth/register", newUserData);
    return response.data;
  },
  login: async (userData: LoginUserInput): Promise<AuthResult> => {
    const response = await apiClient.post("/auth/login", userData);
    return response.data;
  },
  logout: async (): Promise<void> => {
    await apiClient.post("/auth/logout");
  },
  checkSession: async (): Promise<AuthResult> => {
    const response = await apiClient.get("/auth/me");
    return response.data;
  },
  requestPasswordReset: async (email: string): Promise<void> => {
    await apiClient.post("/auth/request-password-reset", {
      email,
    });
  },
  resetPassword: async (token: string, password: string): Promise<void> => {
    await apiClient.post("/auth/reset-password", {
      token,
      password,
    });
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
    const response = await apiClient.get("/ai/daily-brief");
    return response.data;
  },
  parseTask: async (text: string): Promise<CreateTaskInput> => {
    const response = await apiClient.post("/ai/parse-task", { text });
    return response.data;
  },
  decomposeTask: async (
    task: CreateTaskInput,
  ): Promise<DecomposeTaskResult> => {
    const response = await apiClient.post("ai/decompose", task);
    return response.data;
  },
};

apiClient.interceptors.request.use((config) => {
  const csrfToken = Cookies.get("csrf_access_token");

  config.headers["X-CSRF-TOKEN"] = csrfToken;

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response.status === 401 && !originalRequest._retry) {
      if (originalRequest.url.includes("/auth/refresh")) {
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
        return Promise.reject(error);
      }
      originalRequest._retry = true;

      await apiClient.post("/auth/refresh");

      return apiClient(originalRequest);
    }
    return Promise.reject(error);
  },
);

export default apiClient;
