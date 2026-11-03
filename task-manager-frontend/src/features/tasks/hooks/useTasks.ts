import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { taskService } from "../api";
import { getBrowserTimeZone } from "../recurrence";
import { calendarRange } from "../utils";
import {
  DEFAULT_VIEW,
  calendarZoomFor,
  isRangedView,
  isTaskView,
  type TaskLayout,
  type TaskView,
} from "../views";
import { trackEvent } from "../../../services/analytics";

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

export interface PageDetails {
  currentPage: number;
  totalItems: number;
  totalPages: number;
}

interface UseTasksProps {
  perPage: number;
  enabled?: boolean;
}

const getDefaultFilters = (): TaskFilters => ({
  search: "",
  project: "",
  label: "",
  priority: "",
  duration: "",
  isCompleted: "false",
  sortBy: "start_at",
  order: "asc",
  currentDate: new Date().toISOString(),
});

const apiParamMap: Record<keyof TaskFilters, string> = {
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

/** URL params that describe where the user is, not what they filtered. */
const LOCATION_PARAMS = ["view", "layout", "cal"];

const readLayout = (value: string | null): TaskLayout =>
  value === "calendar" ? "calendar" : "list";

const readView = (value: string | null): TaskView =>
  isTaskView(value) ? value : DEFAULT_VIEW;

export const useTasks = ({ perPage, enabled = true }: UseTasksProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [defaults] = useState(getDefaultFilters);

  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  const deferredSearch = useDeferredValue(searchInput);

  const currentPage = Number(searchParams.get("page")) || 1;
  const view = readView(searchParams.get("view"));
  const layout = readLayout(searchParams.get("layout"));

  useEffect(() => {
    const handler = setTimeout(() => {
      if ((searchParams.get("q") ?? "") !== deferredSearch) {
        const next = new URLSearchParams(searchParams);
        if (deferredSearch) {
          next.set("q", deferredSearch);
        } else {
          next.delete("q");
        }
        next.set("page", "1");
        setSearchParams(next, { replace: true });
        trackEvent("tasks_searched", { has_query: Boolean(deferredSearch) });
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [deferredSearch, searchParams, setSearchParams]);

  const filters: TaskFilters = {
    search: searchInput,
    project: searchParams.get("project") ?? defaults.project,
    label: searchParams.get("label") ?? defaults.label,
    priority: searchParams.get("priority") ?? defaults.priority,
    duration: searchParams.get("duration") ?? defaults.duration,
    isCompleted: searchParams.get("is_completed") ?? defaults.isCompleted,
    sortBy: searchParams.get("sort_by") ?? defaults.sortBy,
    order: searchParams.get("order") ?? defaults.order,
    currentDate: searchParams.get("current_date") ?? defaults.currentDate,
  };

  const isCalendar = layout === "calendar";

  const result = useQuery({
    queryKey: [
      "tasks",
      {
        ...filters,
        search: deferredSearch,
        view,
        layout,
        page: currentPage,
        perPage,
      },
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      const ranged = isRangedView(view);

      (Object.keys(filters) as (keyof TaskFilters)[]).forEach((key) => {
        const value = key === "search" ? deferredSearch : filters[key];
        if (value && key !== "currentDate") params.set(apiParamMap[key], value);
      });

      if (isCalendar) {
        const { start, end } = calendarRange(filters.currentDate);
        params.set("start_date", start.toISOString());
        params.set("end_date", end.toISOString());
        params.set("project_repeating", "true");
        if (!ranged && view !== "all") params.set("view", view);
      } else {
        if (view !== "all") params.set("view", view);
        params.set("project_repeating", String(ranged));
        params.set("page", String(currentPage));
        params.set("limit", String(perPage));
      }
      if (ranged || view === "overdue") {
        params.set("zone", getBrowserTimeZone() ?? "UTC");
      }

      return taskService.getAll(params);
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
    enabled,
  });

  const loadedPage = result.data;
  useEffect(() => {
    if (
      loadedPage &&
      loadedPage.totalPages > 0 &&
      loadedPage.currentPage > loadedPage.totalPages
    ) {
      const next = new URLSearchParams(searchParams);
      next.set("page", String(loadedPage.totalPages));
      setSearchParams(next, { replace: true });
    }
  }, [loadedPage, searchParams, setSearchParams]);

  const updateFilters = (name: string, value: string) => {
    if (name !== "search" && name !== "currentDate") {
      trackEvent("tasks_filtered", { filter: name });
    }
    const next = new URLSearchParams(searchParams);
    if (name === "search") {
      setSearchInput(value);
    } else {
      const apiKey = apiParamMap[name as keyof TaskFilters];
      if (apiKey && value) {
        next.set(apiKey, value);
      } else {
        next.delete(apiKey);
      }
    }
    next.set("page", "1");
    setSearchParams(next);
  };

  const resetFilters = () => {
    setSearchInput("");
    const params = new URLSearchParams();
    LOCATION_PARAMS.forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    setSearchParams(params);
  };

  const setPage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    setSearchParams(next);
  };

  const selectView = (nextView: TaskView) => {
    trackEvent("tasks_view_selected", { view: nextView });
    const next = new URLSearchParams(searchParams);
    next.set("view", nextView);
    next.set("cal", calendarZoomFor(nextView));
    next.delete("current_date");
    next.set("page", "1");
    setSearchParams(next);
  };

  const selectLayout = (nextLayout: TaskLayout) => {
    const next = new URLSearchParams(searchParams);
    next.set("layout", nextLayout);
    next.set("page", "1");
    setSearchParams(next);
  };

  const isStale = result.isFetching || searchInput !== deferredSearch;

  const isSearching =
    !!searchInput.trim() ||
    !!filters.project ||
    !!filters.label ||
    !!filters.priority ||
    !!filters.duration ||
    (filters.isCompleted !== "" && filters.isCompleted !== "false");

  const totalPages = result.data?.totalPages || 0;
  const totalItems = result.data?.totalTasks || 0;

  return {
    ...result,
    resetFilters,
    pageDetails: { currentPage, totalPages, totalItems },
    filters,
    view,
    layout,
    selectView,
    selectLayout,
    setPage,
    updateFilters,
    isStale,
    isSearching,
    error: result.error ? "Could not get tasks" : "",
  };
};
