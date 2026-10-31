import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import TaskContextProvider from "../context/TaskContext";
import { ThemeProvider } from "../features/users/ThemeContext";
import type { Task } from "../features/tasks/types";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    title: "Write report",
    description: null,
    category: "work",
    isCompleted: false,
    startAt: "2026-03-02T09:00:00Z",
    endAt: "2026-03-02T10:00:00Z",
    createdAt: "2026-03-01T09:00:00Z",
    completedAt: null,
    isRepeating: false,
    repeatBy: null,
    repeatUntil: null,
    isGhost: false,
    seriesId: overrides.id ?? 1,
    ...overrides,
  };
}

interface Options extends Omit<RenderOptions, "wrapper"> {
  route?: string;
  /** Visited paths, oldest first; the last one is current. Lets `navigate(-1)` go somewhere. */
  history?: string[];
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: React.ReactElement,
  { route = "/", history, queryClient = makeQueryClient(), ...options }: Options = {},
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={history ?? [route]}
          initialIndex={(history?.length ?? 1) - 1}
        >
          <ThemeProvider>
            <TaskContextProvider>{children}</TaskContextProvider>
          </ThemeProvider>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}
