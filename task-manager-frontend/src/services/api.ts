import axios from "axios";

const apiClient = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    "https://taskflow-752853711822.europe-west2.run.app/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

const NO_REFRESH_PATHS = [
  "/auth/me",
  "/auth/refresh",
  "/auth/login",
  "/auth/register",
  "/auth/demo",
  "/auth/logout",
];

let sessionExpiredHandler: (() => void) | null = null;
let refreshInFlight: Promise<unknown> | null = null;

export const setSessionExpiredHandler = (handler: (() => void) | null) => {
  sessionExpiredHandler = handler;
};

const skipsRefresh = (url?: string) =>
  NO_REFRESH_PATHS.some((path) => url?.endsWith(path));

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      skipsRefresh(originalRequest.url)
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      refreshInFlight ??= apiClient.post("/auth/refresh").finally(() => {
        refreshInFlight = null;
      });
      await refreshInFlight;
    } catch {
      sessionExpiredHandler?.();
      return Promise.reject(error);
    }

    return apiClient(originalRequest);
  },
);

export default apiClient;
