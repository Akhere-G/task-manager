import apiClient from "../../services/api";
import type { CreateTaskInput, Task } from "./types";

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
    const response = await apiClient.get<GetTaskResult>(url);
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
  update: async (
    id: number,
    taskData: Partial<Task> & { expectedStartAt?: string },
  ): Promise<Task> => {
    const response = await apiClient.patch(`/tasks/${id}`, taskData);
    return response.data;
  },
  delete: async (id: number): Promise<DeleteTaskResult> => {
    const response = await apiClient.delete(`/tasks/${id}`);
    return response.data;
  },
};
