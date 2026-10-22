import axios from "axios";
import { hasAnalyticsSession, trackEvent } from "./analytics";

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url.includes("/auth/refresh")) {
        if (hasAnalyticsSession()) {
          trackEvent("session_expired", undefined, { beacon: true });
        }
        if (!["/login", "/register"].includes(window.location.pathname)) {
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
