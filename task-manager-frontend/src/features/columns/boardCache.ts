import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import type { GetTaskResult } from "../tasks/api";
import type { ColumnKey, TasksByColumn } from "./board";
import type { ProjectColumn } from "./types";

/** The API params that make a task query one column of a board. */
export const columnCategoryParams = (
  projectId: number,
  columnId: ColumnKey,
): Record<string, string> =>
  columnId === null
    ? { project: String(projectId), unassigned: "true" }
    : { project: String(projectId), column: String(columnId) };

// A category query's key is ["tasks", "category", { params, ... }].
const categoryParamsOf = (queryKey: readonly unknown[]) => {
  const detail = queryKey[2];
  if (typeof detail !== "object" || detail === null || !("params" in detail)) {
    return null;
  }
  return detail.params;
};

/** The tasks each column has loaded so far, read from the query cache. */
export function readBoardGroups(
  queryClient: QueryClient,
  projectId: number,
  columns: ProjectColumn[],
): TasksByColumn {
  const cached = queryClient.getQueriesData<InfiniteData<GetTaskResult>>({
    queryKey: ["tasks", "category"],
    type: "active",
  });
  const keys: ColumnKey[] = [null, ...columns.map((column) => column.id)];

  return new Map(
    keys.map((key) => {
      const wanted = JSON.stringify(columnCategoryParams(projectId, key));
      const match = cached.find(
        ([queryKey]) => JSON.stringify(categoryParamsOf(queryKey)) === wanted,
      );
      return [key, match?.[1]?.pages.flatMap((page) => page.tasks) ?? []];
    }),
  );
}
