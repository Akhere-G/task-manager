import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { calculateDateRange } from "../utils";
import { taskService } from "../../../services/api";
import { useDeferredValue, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";

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

const DEFAULT_FILTERS: TaskFilters = {
  search: "",
  category: "",
  duration: "",
  isCompleted: "false",
  dueDate: "",
  sortBy: "start_at",
  order: "asc",
  currentDate: format(new Date(), "yyyy-MM-dd"),
};

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
  defaultFilters = DEFAULT_FILTERS,
  projectRepeating = false,
  enabled = true,
}: UseTasksProps) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  const deferredSearch = useDeferredValue(searchInput);

  const currentPage = Number(searchParams.get("page")) || 1;

  useEffect(() => {
    const handler = setTimeout(() => {
      if (searchParams.get("q") !== deferredSearch) {
        if (deferredSearch) {
          searchParams.set("q", deferredSearch);
        } else {
          searchParams.delete("q");
        }
        searchParams.set("page", "1");
        setSearchParams(searchParams, { replace: true });
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [deferredSearch]);

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
      format(new Date(), "yyyy-MM-dd"),
  };

  function addDateParams(
    searchParams: URLSearchParams,
    value: string,
    currentDate: string,
  ) {
    if (value) {
      const { start, end } = calculateDateRange(value, currentDate);
      searchParams.set("start_date", format(start, "yyyy-MM-dd"));
      searchParams.set("end_date", format(end, "yyyy-MM-dd"));
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
        currentDate: format(filters.currentDate, "M yyyy"),
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

      const result = await taskService.getAll(params);
      if (result.currentPage > result.totalPages) {
        result.currentPage = result.totalPages;
        params.set("page", String(result.currentPage));
        setSearchParams(params);
      }

      return result;
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
    enabled,
  });

  const updateFilters = (name: string, value: string) => {
    if (name === "search") {
      setSearchInput(value);
    } else {
      const apiKey = apiParamMap[name];
      if (apiKey && value) {
        searchParams.set(apiKey, value);
      } else {
        searchParams.delete(apiKey);
      }
    }
    searchParams.set("page", "1");
    setSearchParams(searchParams);
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
    searchParams.set("page", String(page));
    setSearchParams(searchParams);
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
