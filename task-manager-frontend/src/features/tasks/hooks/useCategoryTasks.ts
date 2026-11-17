import { useInfiniteQuery } from "@tanstack/react-query";

import { taskService } from "../api";
import {
  CATEGORY_PAGE_SIZE,
  buildCategoryParams,
  type CategoryQuery,
} from "../taskParams";
import type { Task } from "../types";

export { CATEGORY_PAGE_SIZE };

interface UseCategoryTasksProps extends CategoryQuery {
  enabled?: boolean;
}

const uniqueById = (tasks: Task[]) => [
  ...new Map(tasks.map((task) => [task.id, task])).values(),
];

export const useCategoryTasks = ({
  enabled = true,
  ...query
}: UseCategoryTasksProps) => {
  const { filters, overrides = {}, search, view, params = {} } = query;
  const categoryFilters = { ...filters, ...overrides };

  const result = useInfiniteQuery({
    queryKey: [
      "tasks",
      "category",
      {
        categoryFilters,
        search,
        view,
        params,
        includeProjections: query.includeProjections ?? false,
      },
    ],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      taskService.getAll(buildCategoryParams(query, pageParam)),
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
