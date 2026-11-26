import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useDeferredValue, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { taskService } from "../api";
import {
  apiParamMap,
  buildCalendarParams,
  buildListParams,
  getDefaultFilters,
  type TaskFilters,
} from "../taskParams";
import {
  DEFAULT_VIEW,
  isTaskLayout,
  isTaskView,
  type TaskLayout,
  type TaskView,
} from "../views";
import { trackEvent } from "../../../services/analytics";

export type { TaskFilters };

interface UseTasksProps {
  enabled?: boolean;
}

/** URL params that describe where the user is, not what they filtered. */
const LOCATION_PARAMS = ["view", "layout", "cal"];

// Lists, matrix quadrants and board columns load their own tasks, so this
// query only supplies the header total.
const TOTAL_ONLY_PAGE_SIZE = 1;

const readLayout = (value: string | null): TaskLayout =>
  isTaskLayout(value) ? value : "list";

const readView = (value: string | null): TaskView =>
  isTaskView(value) ? value : DEFAULT_VIEW;

// A board shows every task of its project, done or not, in manual order. The
// list shows every group, so completion is not a filter there.
const filtersForLayout = (
  layout: TaskLayout,
  filters: TaskFilters,
): TaskFilters => {
  if (layout === "kanban") {
    return { ...filters, isCompleted: "all", sortBy: "manual", order: "asc" };
  }
  if (layout === "list") return { ...filters, isCompleted: "" };
  return filters;
};

export const useTasks = ({ enabled = true }: UseTasksProps = {}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [defaults] = useState(getDefaultFilters);

  const [draft, setDraft] = useState<string | null>(null);
  const searchInput = draft ?? searchParams.get("q") ?? "";
  const deferredSearch = useDeferredValue(searchInput);

  const view = readView(searchParams.get("view"));
  const layout = readLayout(searchParams.get("layout"));

  useEffect(() => {
    if (draft === null) return;
    const handler = setTimeout(() => {
      if ((searchParams.get("q") ?? "") !== draft) {
        const next = new URLSearchParams(searchParams);
        if (draft) {
          next.set("q", draft);
        } else {
          next.delete("q");
        }
        setSearchParams(next, { replace: true });
        trackEvent("tasks_searched", { has_query: Boolean(draft) });
      }
      setDraft(null);
    }, 400);

    return () => clearTimeout(handler);
  }, [draft, searchParams, setSearchParams]);

  const searchFilters: TaskFilters = {
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
  const filters = filtersForLayout(layout, searchFilters);

  const result = useQuery({
    queryKey: [
      "tasks",
      {
        ...filters,
        search: deferredSearch,
        view,
        layout,
      },
    ],
    queryFn: () =>
      taskService.getAll(
        isCalendar
          ? buildCalendarParams(filters, deferredSearch, view)
          : buildListParams({
              filters,
              search: deferredSearch,
              view,
              page: 1,
              limit: TOTAL_ONLY_PAGE_SIZE,
            }),
      ),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
    enabled,
  });

  const updateFilters = (name: string, value: string) => {
    if (name !== "search" && name !== "currentDate") {
      trackEvent("tasks_filtered", { filter: name });
    }
    const next = new URLSearchParams(searchParams);
    if (name === "search") {
      setDraft(value);
    } else {
      const apiKey = apiParamMap[name as keyof TaskFilters];
      if (apiKey && value) {
        next.set(apiKey, value);
      } else {
        next.delete(apiKey);
      }
    }
    setSearchParams(next);
  };

  const resetFilters = () => {
    setDraft(null);
    const params = new URLSearchParams();
    LOCATION_PARAMS.forEach((key) => {
      const value = searchParams.get(key);
      if (value) params.set(key, value);
    });
    setSearchParams(params);
  };

  const selectInbox = () => {
    trackEvent("tasks_view_selected", { view: "inbox" });
    const next = new URLSearchParams(searchParams);
    next.set("view", "inbox");
    next.delete("project");
    setSearchParams(next);
  };

  // Choosing a project, or all of them, leaves the inbox.
  const selectProject = (projectId: string) => {
    trackEvent("tasks_filtered", { filter: "project" });
    const next = new URLSearchParams(searchParams);
    next.delete("view");
    if (projectId) {
      next.set("project", projectId);
    } else {
      next.delete("project");
    }
    setSearchParams(next);
  };

  const selectLayout = (nextLayout: TaskLayout) => {
    const next = new URLSearchParams(searchParams);
    next.set("layout", nextLayout);
    setSearchParams(next);
  };

  const isStale = result.isPlaceholderData || searchInput !== deferredSearch;

  const isSearching =
    !!searchInput.trim() ||
    !!filters.project ||
    !!filters.label ||
    !!filters.priority ||
    !!filters.duration ||
    (filters.isCompleted !== "" && filters.isCompleted !== "false");

  return {
    ...result,
    resetFilters,
    filters,
    search: deferredSearch,
    view,
    layout,
    selectInbox,
    selectProject,
    selectLayout,
    updateFilters,
    isStale,
    isSearching,
    error: result.error ? "Could not get tasks" : "",
  };
};
