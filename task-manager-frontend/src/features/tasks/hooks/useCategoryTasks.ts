import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";

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

export const categoryTasksKey = ({
  filters,
  overrides = {},
  search,
  view,
  params = {},
}: CategoryQuery) => [
  "tasks",
  "category",
  {
    categoryFilters: { ...filters, ...overrides, search },
    search,
    view,
    params,
  },
];

export const useCategoryTasks = ({
  enabled = true,
  ...query
}: UseCategoryTasksProps) => {
  const queryKey = categoryTasksKey(query);

  const result = useInfiniteQuery({
    queryKey,
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      taskService.getAll(buildCategoryParams(query, pageParam)),
    getNextPageParam: (lastPage) =>
      lastPage.currentPage < lastPage.totalPages
        ? lastPage.currentPage + 1
        : undefined,
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
    enabled,
  });

  const pages = result.data?.pages;
  // A stable list lets the sortable list tell a refetch from a re-render.
  const tasks = useMemo(
    () => uniqueById((pages ?? []).flatMap((page) => page.tasks)),
    [pages],
  );
  const latest = pages?.at(-1);

  return {
    queryKey,
    tasks,
    total: latest?.totalTasks ?? 0,
    totalMinutes: latest?.totalMinutes ?? 0,
    hasNextPage: result.hasNextPage,
    fetchNextPage: result.fetchNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
    isLoading: result.isLoading,
    isError: result.isError,
  };
};
