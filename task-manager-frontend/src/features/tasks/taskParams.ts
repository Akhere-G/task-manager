import { getBrowserTimeZone } from "./recurrence";
import { calendarRange } from "./utils";
import { isRangedView, type TaskView } from "./views";

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

const addZone = (params: URLSearchParams, view: TaskView) => {
  if (isRangedView(view) || view === "overdue") {
    params.set("zone", getBrowserTimeZone() ?? "UTC");
  }
};

interface ListParamsInput {
  filters: TaskFilters;
  search: string;
  view: TaskView;
  page: number;
  limit: number;
  includeProjections: boolean;
}

export const buildListParams = ({
  filters,
  search,
  view,
  page,
  limit,
  includeProjections,
}: ListParamsInput) => {
  const params = filterParams(filters, search);
  if (view !== "all") params.set("view", view);
  params.set("project_repeating", String(includeProjections));
  params.set("page", String(page));
  params.set("limit", String(limit));
  addZone(params, view);
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
  if (!isRangedView(view) && view !== "all") params.set("view", view);
  addZone(params, view);
  return params;
};
