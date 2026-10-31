import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, renderHook, type RenderOptions } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import AuthContextProvider from "../context/AuthContext";
import TaskContextProvider from "../context/TaskContext";
import { ThemeProvider } from "../features/users/ThemeContext";
import type { Task } from "../features/tasks/types";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0, gcTime: Infinity },
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

/** A projected occurrence of series `seriesId` on `day` (YYYYMMDD), as the API sends it. */
export function makeGhost(seriesId: number, day: string, overrides: Partial<Task> = {}): Task {
  return makeTask({
    id: `ghost_${seriesId}_${day}` as unknown as number,
    seriesId,
    isGhost: true,
    isRepeating: true,
    repeatBy: "daily",
    ...overrides,
  });
}

interface ProviderOptions {
  route?: string;
  /** Visited paths, oldest first; the last one is current. Lets `navigate(-1)` go somewhere. */
  history?: string[];
  queryClient?: QueryClient;
  withAuth?: boolean;
}

/** The app's provider stack, in the same order as main.tsx. */
export function Providers({
  children,
  route = "/",
  history,
  queryClient = makeQueryClient(),
  withAuth = false,
}: ProviderOptions & { children: ReactNode }) {
  const tasks = (
    <TaskContextProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </TaskContextProvider>
  );
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={history ?? [route]}
        initialIndex={(history?.length ?? 1) - 1}
      >
        {withAuth ? <AuthContextProvider>{tasks}</AuthContextProvider> : tasks}
      </MemoryRouter>
    </QueryClientProvider>
  );
}

export function renderWithProviders(
  ui: React.ReactElement,
  {
    queryClient = makeQueryClient(),
    route,
    history,
    withAuth,
    ...options
  }: ProviderOptions & Omit<RenderOptions, "wrapper"> = {},
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Providers route={route} history={history} queryClient={queryClient} withAuth={withAuth}>
      {children}
    </Providers>
  );
  return { queryClient, ...render(ui, { wrapper, ...options }) };
}

export function renderHookWithProviders<Result>(
  hook: () => Result,
  { queryClient = makeQueryClient() }: { queryClient?: QueryClient } = {},
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Providers queryClient={queryClient}>{children}</Providers>
  );
  return { queryClient, ...renderHook(hook, { wrapper }) };
}
