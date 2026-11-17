import apiClient from "../../services/api";
import type { TaskViewCounts } from "./views";
import type {
  CreateTaskInput,
  SnoozeInput,
  Subtask,
  SubtaskInput,
  Task,
  TrashedTask,
} from "./types";

export interface GetTaskResult {
  tasks: Task[];
  totalTasks: number;
  totalMinutes: number;
  totalPages: number;
  currentPage: number;
}
export interface GetTrashResult {
  tasks: TrashedTask[];
  totalTasks: number;
  totalPages: number;
  currentPage: number;
}
export interface RescheduleTaskInput {
  previousStartAt: string;
  previousEndAt: string;
  startAt: string;
  endAt: string;
  isGhost: boolean;
}
interface DeleteTaskResult {
  id: string;
  message: string;
}

export interface MoveInput {
  afterId: number | null;
  beforeId: number | null;
}

export const taskService = {
  getAll: async (params?: URLSearchParams): Promise<GetTaskResult> => {
    const url = "/tasks" + (params ? `?${params.toString()}` : "");
    const response = await apiClient.get<GetTaskResult>(url);
    return response.data;
  },
  getCounts: async (zone: string): Promise<TaskViewCounts> => {
    const response = await apiClient.get<{ counts: TaskViewCounts }>(
      "/tasks/counts",
      { params: { zone } },
    );
    return response.data.counts;
  },
  getById: async (id: number): Promise<Task> => {
    const response = await apiClient.get(`tasks/${id}`);
    return response.data;
  },
  create: async (taskData: CreateTaskInput) => {
    const response = await apiClient.post("/tasks", taskData);
    return response.data;
  },
  addSubtasks: async (
    parentId: number,
    subtasks: SubtaskInput[],
  ): Promise<Subtask[]> => {
    const response = await apiClient.post<{ subtasks: Subtask[] }>(
      `/tasks/${parentId}/subtasks`,
      { subtasks },
    );
    return response.data.subtasks;
  },
  replaceSubtasks: async (
    parentId: number,
    subtasks: SubtaskInput[],
  ): Promise<Subtask[]> => {
    const response = await apiClient.put<{ subtasks: Subtask[] }>(
      `/tasks/${parentId}/subtasks`,
      { subtasks },
    );
    return response.data.subtasks;
  },
  reorderSubtasks: async (
    parentId: number,
    ids: number[],
  ): Promise<Subtask[]> => {
    const response = await apiClient.put<{ subtasks: Subtask[] }>(
      `/tasks/${parentId}/subtasks/order`,
      { ids },
    );
    return response.data.subtasks;
  },
  bulkComplete: async (ids: number[]): Promise<number> => {
    const response = await apiClient.post<{ updated: number }>(
      "/tasks/bulk-complete",
      { ids },
    );
    return response.data.updated;
  },
  bulkDelete: async (ids: number[]): Promise<number> => {
    const response = await apiClient.post<{ updated: number }>(
      "/tasks/bulk-delete",
      { ids },
    );
    return response.data.updated;
  },
  bulkSnooze: async (
    ids: number[],
    snooze: Omit<SnoozeInput, "isGhost" | "previousStartAt">,
  ): Promise<number> => {
    const response = await apiClient.post<{ updated: number }>(
      "/tasks/bulk-snooze",
      { ids, ...snooze },
    );
    return response.data.updated;
  },
  createAll: async (tasksData: CreateTaskInput[]) => {
    const response = await apiClient.post("/tasks/bulk", tasksData);
    return response.data;
  },
  update: async (
    id: number,
    taskData: Partial<Task> & {
      expectedStartAt?: string;
      skipOccurrence?: boolean;
    },
  ): Promise<Task> => {
    const response = await apiClient.patch(`/tasks/${id}`, taskData);
    return response.data;
  },
  reschedule: async (
    id: number,
    rescheduleData: RescheduleTaskInput,
  ): Promise<Task> => {
    const response = await apiClient.post(
      `/tasks/${id}/reschedule`,
      rescheduleData,
    );
    return response.data;
  },
  move: async (id: number, input: MoveInput): Promise<Task> => {
    const response = await apiClient.post(`/tasks/${id}/move`, input);
    return response.data;
  },
  snooze: async (id: number, input: SnoozeInput): Promise<Task> => {
    const response = await apiClient.post(`/tasks/${id}/snooze`, input);
    return response.data;
  },
  delete: async (id: number): Promise<DeleteTaskResult> => {
    const response = await apiClient.delete(`/tasks/${id}`);
    return response.data;
  },
  getTrash: async (page: number): Promise<GetTrashResult> => {
    const response = await apiClient.get<GetTrashResult>("/tasks/trash", {
      params: { page },
    });
    return response.data;
  },
  restore: async (id: number): Promise<TrashedTask> => {
    const response = await apiClient.post(`/tasks/${id}/restore`);
    return response.data;
  },
};
