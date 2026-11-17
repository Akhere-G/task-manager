import { getBrowserTimeZone } from "./recurrence";
import { calendarRange } from "./utils";
import type { TaskView } from "./views";

export interface TaskFilters {
  search: string;
  project: string;
  label: string;
  priority: string;
  duration: string;
  isCompleted: string;
  sortBy: string;
  order: string;
  currentDate: string;
}

export const apiParamMap: Record<keyof TaskFilters, string> = {
  search: "q",
  project: "project",
  label: "label",
  priority: "priority",
  duration: "duration",
  isCompleted: "is_completed",
  sortBy: "sort_by",
  order: "order",
  currentDate: "current_date",
};

const filterParams = (filters: TaskFilters, search: string) => {
  const params = new URLSearchParams();
  (Object.keys(filters) as (keyof TaskFilters)[]).forEach((key) => {
    const value = key === "search" ? search : filters[key];
    if (value && key !== "currentDate") params.set(apiParamMap[key], value);
  });
  return params;
};

interface ListParamsInput {
  filters: TaskFilters;
  search: string;
  view: TaskView;
  page: number;
  limit: number;
}

export const buildListParams = ({
  filters,
  search,
  view,
  page,
  limit,
}: ListParamsInput) => {
  const params = filterParams(filters, search);
  if (view !== "all") params.set("view", view);
  params.set("page", String(page));
  params.set("limit", String(limit));
  return params;
};

export const buildCalendarParams = (
  filters: TaskFilters,
  search: string,
  view: TaskView,
) => {
  const params = filterParams(filters, search);
  const { start, end } = calendarRange(filters.currentDate);
  params.set("start_date", start.toISOString());
  params.set("end_date", end.toISOString());
  params.set("project_repeating", "true");
  if (view !== "all") params.set("view", view);
  return params;
};

export interface CategoryQuery {
  filters: TaskFilters;
  search: string;
  view: TaskView;
  /** Filters that define the category, such as one priority. */
  overrides?: Partial<TaskFilters>;
  /** Raw API params that define the category, such as one board column. */
  params?: Record<string, string>;
}

export const CATEGORY_PAGE_SIZE = 10;

const PAGING_PARAMS = ["page", "limit", "sort_by", "order"];

export const buildCategoryParams = (query: CategoryQuery, page: number) => {
  const { filters, search, view, overrides, params } = query;
  const queryParams = buildListParams({
    filters: { ...filters, ...overrides },
    search,
    view,
    page,
    limit: CATEGORY_PAGE_SIZE,
  });
  queryParams.set("zone", getBrowserTimeZone() ?? "UTC");
  for (const [name, value] of Object.entries(params ?? {})) {
    queryParams.set(name, value);
  }
  return queryParams;
};

/** What a bulk action sends to reach every task in the category, loaded or not. */
export const buildCategoryFilter = (query: CategoryQuery) => {
  const queryParams = buildCategoryParams(query, 1);
  for (const name of PAGING_PARAMS) {
    queryParams.delete(name);
  }
  return Object.fromEntries(queryParams);
};
