import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";

// Dates are formatted in local time; pin it so the suite behaves the same everywhere.
process.env.TZ = "UTC";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    restoreMocks: true,
  },
});
