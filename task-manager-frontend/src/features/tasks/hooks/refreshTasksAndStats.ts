import type { QueryClient } from "@tanstack/react-query";

export const refreshTasksAndStats = (queryClient: QueryClient) =>
  Promise.all(
    ["tasks", "stats"].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  );
