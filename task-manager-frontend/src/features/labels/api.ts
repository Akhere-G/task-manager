import apiClient from "../../services/api";
import type { Label, LabelInput } from "./types";

export const labelService = {
  getAll: async (): Promise<Label[]> => {
    const response = await apiClient.get<{ labels: Label[] }>("/labels");
    return response.data.labels;
  },
  create: async (input: LabelInput): Promise<Label> => {
    const response = await apiClient.post<Label>("/labels", input);
    return response.data;
  },
  update: async (id: number, input: Partial<LabelInput>): Promise<Label> => {
    const response = await apiClient.patch<Label>(`/labels/${id}`, input);
    return response.data;
  },
  delete: async (id: number) => {
    await apiClient.delete(`/labels/${id}`);
  },
};
