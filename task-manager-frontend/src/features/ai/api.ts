import apiClient from "../../services/api";
import type { CreateTaskInput, Priority, Subtask } from "../tasks/types";

export type ExistingSubtask = Pick<Subtask, "title" | "description">;

export interface DailyBrief {
  brief: string;
}

export interface DecomposeTaskResult {
  tasks: CreateTaskInput[];
}

export interface PrioritySuggestion {
  taskId: number;
  title: string;
  currentPriority: Priority;
  suggestedPriority: Priority;
  reason: string;
}

export const aiService = {
  getDailyBrief: async (): Promise<DailyBrief> => {
    const response = await apiClient.get("/ai/daily-brief", {
      params: { tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
    });
    return response.data;
  },
  parseTask: async (text: string): Promise<CreateTaskInput> => {
    const response = await apiClient.post("/ai/parse-task", { text });
    return response.data;
  },
  suggestPriorities: async (): Promise<PrioritySuggestion[]> => {
    const response = await apiClient.post("/ai/suggest-priorities");
    return response.data.suggestions;
  },
  decomposeTask: async (
    task: CreateTaskInput,
    existingSubtasks: ExistingSubtask[] = [],
  ): Promise<DecomposeTaskResult> => {
    const response = await apiClient.post("ai/decompose", {
      ...task,
      existingSubtasks,
    });
    return response.data;
  },
};
