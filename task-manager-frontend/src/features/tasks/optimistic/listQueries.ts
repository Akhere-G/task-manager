import type { TaskFilters } from "../taskParams";
import { isTaskView, type TaskView } from "../views";

export interface ListQuery {
  filters: TaskFilters;
  view: TaskView;
  params: Record<string, string>;
  isCalendar: boolean;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFilters = (value: unknown): value is TaskFilters =>
  isRecord(value) &&
  typeof value.sortBy === "string" &&
  typeof value.order === "string";

const isParams = (value: unknown): value is Record<string, string> =>
  isRecord(value) &&
  Object.values(value).every((param) => typeof param === "string");

const viewOf = (value: unknown): TaskView =>
  typeof value === "string" && isTaskView(value) ? value : "all";

export const categoryParamsOf = (queryKey: readonly unknown[]) => {
  const detail = queryKey[2];
  return isRecord(detail) && isParams(detail.params) ? detail.params : null;
};

export const listQueryOf = (queryKey: readonly unknown[]): ListQuery | null => {
  if (queryKey[1] === "category") {
    const detail = queryKey[2];
    if (!isRecord(detail) || !isFilters(detail.categoryFilters)) return null;
    return {
      filters: detail.categoryFilters,
      view: viewOf(detail.view),
      params: categoryParamsOf(queryKey) ?? {},
      isCalendar: false,
    };
  }

  const overview = queryKey[1];
  if (!isRecord(overview) || !isFilters(overview)) return null;
  return {
    filters: overview,
    view: viewOf("view" in overview ? overview.view : undefined),
    params: {},
    isCalendar: "layout" in overview && overview.layout === "calendar",
  };
};
