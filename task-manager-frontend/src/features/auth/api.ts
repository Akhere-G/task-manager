import apiClient from "../../services/api";
import type { LoginUserInput, RegisterUserInput, User } from "./types";

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
  demoLogin: async (): Promise<AuthResult> => {
    const response = await apiClient.post("/auth/demo");
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
