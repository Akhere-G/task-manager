import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { calculateDateRange } from "../utils";
import { useDeferredValue, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { taskService } from "../api";
import { trackEvent } from "../../../services/analytics";

export interface TaskFilters {
  search: string;
  category: string;
  duration: string;
  isCompleted: string;
  dueDate: string;
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
  perPage: number | null;
  defaultFilters?: TaskFilters;
  projectRepeating?: boolean;
  enabled?: boolean;
}

const getDefaultFilters = (): TaskFilters => ({
  search: "",
  category: "",
  duration: "",
  isCompleted: "false",
  dueDate: "",
  sortBy: "start_at",
  order: "asc",
  currentDate: new Date().toISOString(),
});

const apiParamMap: Record<string, string> = {
  search: "q",
  category: "category",
  duration: "duration",
  isCompleted: "is_completed",
  dueDate: "due_date",
  sortBy: "sort_by",
  order: "order",
  currentDate: "current_date",
};

export const useTasks = ({
  perPage,
  defaultFilters: providedDefaults,
  projectRepeating = false,
  enabled = true,
}: UseTasksProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [initialDefaults] = useState(getDefaultFilters);
  const defaultFilters = providedDefaults ?? initialDefaults;

  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  const deferredSearch = useDeferredValue(searchInput);

  const currentPage = Number(searchParams.get("page")) || 1;

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

  const filters = {
    search: searchInput,
    category: searchParams.get("category") ?? defaultFilters.category,
    duration: searchParams.get("duration") ?? defaultFilters.duration,
    isCompleted: searchParams.get("is_completed") ?? defaultFilters.isCompleted,
    dueDate: searchParams.get("due_date") ?? defaultFilters.dueDate,
    sortBy: searchParams.get("sort_by") ?? defaultFilters.sortBy,
    order: searchParams.get("order") ?? defaultFilters.order,
    currentDate:
      searchParams.get("current_date") ??
      defaultFilters.currentDate ??
      new Date().toISOString(),
  };

  function addDateParams(
    searchParams: URLSearchParams,
    value: string,
    currentDate: string,
  ) {
    if (value) {
      const { start, end } = calculateDateRange(value, currentDate);
      searchParams.set("start_date", start.toISOString());
      searchParams.set("end_date", end.toISOString());
      if (value === "overdue") searchParams.set("is_completed", "false");
    }
  }

  const result = useQuery({
    queryKey: [
      "tasks",
      {
        ...filters,
        search: deferredSearch,
        page: currentPage,
        currentDate: filters.currentDate,
        perPage,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("project_repeating", String(projectRepeating));

      Object.entries(filters).forEach(([key, value]) => {
        const apiKey = apiParamMap[key];
        if (apiKey && value) {
          if (key === "search") {
            params.set(apiKey, String(deferredSearch));
          } else {
            params.set(apiKey, String(value));
          }
        }
      });

      addDateParams(params, filters.dueDate, filters.currentDate);

      if (perPage) {
        params.set("page", String(currentPage));
        params.set("limit", String(perPage));
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
      const apiKey = apiParamMap[name];
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

    Object.entries(defaultFilters).forEach(([key, value]) => {
      const apiKey = apiParamMap[key];
      if (apiKey && value) {
        params.set(apiKey, String(value));
      }
    });
    setSearchParams(params);
  };

  const setPage = (page: number) => {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    setSearchParams(next);
  };

  const isStale = result.isFetching || searchInput !== deferredSearch;

  const isSearching =
    !!searchInput.trim() ||
    !!filters.category ||
    !!filters.duration ||
    (filters.isCompleted !== "" && filters.isCompleted !== "false") ||
    !!filters.dueDate;

  const totalPages = result.data?.totalPages || 0;
  const totalItems = result.data?.totalTasks || 0;

  return {
    ...result,
    resetFilters,
    pageDetails: { currentPage, totalPages, totalItems },
    filters,
    setPage,
    updateFilters,
    isStale,
    isSearching,
    error: result.error ? "Could not get tasks" : "",
  };
};
