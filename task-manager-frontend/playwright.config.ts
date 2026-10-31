import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5174);
const API_PORT = Number(process.env.E2E_API_PORT ?? 5001);
const backendDir = path.resolve(import.meta.dirname, "../task-manager-backend");
const venvPython = path.join(backendDir, "venv", "bin", "python");
const python = process.env.E2E_PYTHON ?? (existsSync(venvPython) ? venvPython : "python");

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "on-first-retry",
    serviceWorkers: "block",
    timezoneId: "UTC",
    locale: "en-GB",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      // Flask against the dedicated task_manager_e2e database; see tests/e2e_server.py.
      command: `"${python}" -m tests.e2e_server`,
      cwd: backendDir,
      url: `http://127.0.0.1:${API_PORT}/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        E2E_API_PORT: String(API_PORT),
        E2E_FRONTEND_URL: `http://localhost:${WEB_PORT}`,
        PYTHONUNBUFFERED: "1",
      },
    },
    {
      command: `npm run dev -- --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        VITE_API_URL: `http://localhost:${API_PORT}/api`,
        VITE_POSTHOG_PROJECT_TOKEN: "",
        VITE_POSTHOG_HOST: "",
      },
    },
  ],
});
