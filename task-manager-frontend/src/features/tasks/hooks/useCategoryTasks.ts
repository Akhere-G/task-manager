import { useInfiniteQuery } from "@tanstack/react-query";

import { taskService } from "../api";
import { buildListParams, type TaskFilters } from "../taskParams";
import type { Task } from "../types";
import type { TaskView } from "../views";

export const CATEGORY_PAGE_SIZE = 10;

interface UseCategoryTasksProps {
  filters: TaskFilters;
  search: string;
  view: TaskView;
  /** Filters that define the category, such as one priority. */
  overrides?: Partial<TaskFilters>;
  /** Raw API params that define the category, such as one board column. */
  params?: Record<string, string>;
  includeProjections?: boolean;
  enabled?: boolean;
}

const uniqueById = (tasks: Task[]) => [
  ...new Map(tasks.map((task) => [task.id, task])).values(),
];

export const useCategoryTasks = ({
  filters,
  search,
  view,
  overrides = {},
  params = {},
  includeProjections = false,
  enabled = true,
}: UseCategoryTasksProps) => {
  const categoryFilters = { ...filters, ...overrides };

  const result = useInfiniteQuery({
    queryKey: [
      "tasks",
      "category",
      { categoryFilters, search, view, params, includeProjections },
    ],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => {
      const query = buildListParams({
        filters: categoryFilters,
        search,
        view,
        page: pageParam,
        limit: CATEGORY_PAGE_SIZE,
        includeProjections,
      });
      Object.entries(params).forEach(([name, value]) => query.set(name, value));
      return taskService.getAll(query);
    },
    getNextPageParam: (lastPage) =>
      lastPage.currentPage < lastPage.totalPages
        ? lastPage.currentPage + 1
        : undefined,
    staleTime: 1000 * 60 * 5,
    enabled,
  });

  const pages = result.data?.pages ?? [];
  const latest = pages.at(-1);

  return {
    tasks: uniqueById(pages.flatMap((page) => page.tasks)),
    total: latest?.totalTasks ?? 0,
    totalMinutes: latest?.totalMinutes ?? 0,
    hasNextPage: result.hasNextPage,
    fetchNextPage: result.fetchNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    isLoading: result.isLoading,
    isError: result.isError,
  };
};
