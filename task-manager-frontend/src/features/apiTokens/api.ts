import apiClient from "../../services/api";
import type { ApiToken, ApiTokenInput, CreatedApiToken } from "./types";

export const apiTokenService = {
  getAll: async (): Promise<ApiToken[]> => {
    const response = await apiClient.get<{ tokens: ApiToken[] }>("/api-tokens");
    return response.data.tokens;
  },
  create: async (input: ApiTokenInput): Promise<CreatedApiToken> => {
    const response = await apiClient.post<CreatedApiToken>(
      "/api-tokens",
      input,
    );
    return response.data;
  },
  delete: async (id: number) => {
    await apiClient.delete(`/api-tokens/${id}`);
  },
};
