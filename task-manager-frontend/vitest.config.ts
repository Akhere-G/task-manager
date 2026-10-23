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
    // Route tests load lazy pages (calendar, charts) on first use, which can be slow when
    // workers run in parallel.
    testTimeout: 15_000,
    restoreMocks: true,
    // TaskCalendar re-throws a failed reschedule from an un-awaited handler, so the rollback
    // test necessarily produces this one rejection. Anything else still fails the run.
    onUnhandledError: (error) =>
      error.message === "Network Error" ? false : undefined,
  },
});
