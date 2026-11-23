import apiClient from "../../services/api";
import type {
  CreateTaskInput,
  Priority,
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

/** Listed tasks, or every task in a category (the server resolves the filter). */
export type BulkTarget = { ids: number[] } | { filter: Record<string, string> };

export type BulkSnoozeInput = Omit<SnoozeInput, "isGhost" | "previousStartAt">;

export interface BulkResult {
  updated: number;
  matched: number;
}

const postBulk = async (
  action: string,
  target: BulkTarget,
  extra: object = {},
): Promise<BulkResult> => {
  const response = await apiClient.post<BulkResult>(`/tasks/bulk-${action}`, {
    ...target,
    ...extra,
  });
  return response.data;
};

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
  bulkComplete: (target: BulkTarget) => postBulk("complete", target),
  bulkDelete: (target: BulkTarget) => postBulk("delete", target),
  bulkSnooze: (target: BulkTarget, snooze: BulkSnoozeInput) =>
    postBulk("snooze", target, snooze),
  bulkPriority: (target: BulkTarget, priority: Priority) =>
    postBulk("priority", target, { priority }),
  bulkMove: (target: BulkTarget, columnId: number | null) =>
    postBulk("move", target, { columnId }),
  createAll: async (tasksData: CreateTaskInput[]) => {
    const response = await apiClient.post("/tasks/bulk", tasksData);
    return response.data;
  },
  update: async (
    id: number,
    taskData: Partial<Task> & { skipOccurrence?: boolean },
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
