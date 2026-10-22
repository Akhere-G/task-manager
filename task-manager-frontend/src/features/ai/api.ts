import apiClient from "../../services/api";
import type { CreateTaskInput } from "../tasks/types";

export interface DailyBrief {
  brief: string;
}

export interface DecomposeTaskResult {
  tasks: CreateTaskInput[];
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
  decomposeTask: async (
    task: CreateTaskInput,
  ): Promise<DecomposeTaskResult> => {
    const response = await apiClient.post("ai/decompose", task);
    return response.data;
  },
};
