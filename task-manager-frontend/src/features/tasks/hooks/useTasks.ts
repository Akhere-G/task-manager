import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { formatDate } from "../utils";
import { taskService } from "../../../services/api";
import { useDeferredValue, useEffect, useState } from "react";

export interface TaskFilters {
  search: string;
  category: string;
  duration: string;
  isCompleted: string;
  dueDate: string;
  sortBy: string;
  order: string;
}

export interface PageDetails {
  currentPage: number;
  totalItems: number;
  totalPages: number;
}

interface UseTasksProps {
  perPage: number | null;
}

export const useTasks = ({ perPage }: UseTasksProps) => {
  const [pageDetails, setPageDetails] = useState<PageDetails>({
    currentPage: 1,
    totalItems: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState<TaskFilters>({
    search: "",
    category: "",
    duration: "",
    isCompleted: "false",
    dueDate: "",
    sortBy: "due_date",
    order: "asc",
  });

  const deferredSearch = useDeferredValue(filters.search);

  const result = useQuery({
    queryKey: [
      "tasks",
      {
        ...filters,
        search: deferredSearch,
        page: pageDetails.currentPage,
        perPage,
      },
    ],
    queryFn: async () => {
      const params = new URLSearchParams();

      const apiParamMap: Record<string, string> = {
        search: "q",
        category: "category",
        duration: "task_duration",
        isCompleted: "is_completed",
        dueDate: "due_date",
        sortBy: "sort_by",
        order: "order",
      };

      Object.entries(filters).forEach(([key, value]) => {
        const apiKey = apiParamMap[key];
        if (apiKey && value !== undefined && value !== "") {
          params.set(apiKey, String(value));
        }
      });

      if (filters.dueDate) {
        params.set("today", formatDate());
      }

      if (perPage) {
        params.set("page", String(pageDetails.currentPage));
        params.set("limit", String(perPage));
      }

      return await taskService.getAll(params);
    },
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    const { data } = result;
    if (data) {
      setPageDetails((prev) => ({
        totalPages: data.totalPages,
        totalItems: data.totalTasks,
        currentPage:
          data.totalPages < prev.currentPage && data.totalPages > 0
            ? data.totalPages
            : prev.currentPage, // if deleting a task on a page with one task, go to previous page
      }));
    }
  }, [result.data?.totalPages, result.data?.totalTasks]);

  const updateFilters = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    setPageDetails((prev) => ({ ...prev, currentPage: 1 }));
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const resetFilters = () => {
    setFilters({
      search: "",
      category: "",
      duration: "",
      isCompleted: "false",
      dueDate: "",
      sortBy: "due_date",
      order: "asc",
    });
  };

  const setPage = (page: number) => {
    setPageDetails((prev) => ({ ...prev, currentPage: page }));
  };

  const isStale = result.isFetching || filters.search !== deferredSearch;

  const isSearching =
    !!filters.search.trim() ||
    !!filters.category ||
    !!filters.duration ||
    filters.isCompleted !== "false" ||
    !!filters.dueDate;

  return {
    ...result,
    error: result.error ? "Could not get tasks." : "",
    pageDetails,
    setPageDetails,
    filters,
    setPage,
    isStale,
    isSearching,
    updateFilters,
    resetFilters,
  };
};
