import { useDeferredValue, useEffect, useState } from "react";
import type { CreateTaskInput, Task } from "../types";
import { formatDate } from "../utils";
import { taskService } from "../../../services/api";

interface UseGetTasksProps {
  perPage?: number;
}

export default function useGetTasks(props?: UseGetTasksProps) {
  const { perPage } = props ?? {};
  const [tasks, setTasks] = useState<null | Task[]>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDeleteTask, setSelectedDeleteTask] = useState<Task | null>(
    null,
  );
  const [selectedEditTask, setSelectedEditTask] = useState<Task | null>(null);
  const [pageDetails, setPageDetails] = useState({
    currentPage: 1,
    totalItems: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    duration: "",
    isCompleted: "false",
    dueDate: "",
    sortBy: "due_date",
    order: "asc",
  });

  const deferredSearch = useDeferredValue(filters.search);

  useEffect(() => {
    async function fetchTasks() {
      setIsLoading(true);
      try {
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

        const newFilters = {
          search: deferredSearch,
          category: filters.category,
          duration: filters.duration,
          isCompleted: filters.isCompleted,
          dueDate: filters.dueDate,
          sortBy: filters.sortBy,
          order: filters.order,
        };

        Object.entries(newFilters).forEach(([key, value]) => {
          if (value) {
            params.set(apiParamMap[key], value);
          } else {
            params.delete(apiParamMap[key]);
          }
        });

        if (filters.dueDate) {
          params.set("today", formatDate());
        }

        if (perPage) {
          params.set("page", String(pageDetails.currentPage));
          params.set("limit", String(perPage));
        }

        const { tasks, totalPages, totalTasks } =
          await taskService.getAll(params);
        setTasks(tasks);
        setPageDetails((prev) => ({
          ...prev,
          totalPages,
          totalItems: totalTasks,
        }));
        setError(null);
      } catch (err) {
        setError("Couldn't load tasks.");
        console.log(err);
      } finally {
        setIsLoading(false);
      }
    }

    const delayDebounceFn = setTimeout(fetchTasks, deferredSearch ? 400 : 0);

    return () => clearTimeout(delayDebounceFn);
  }, [
    deferredSearch,
    filters.category,
    filters.duration,
    filters.isCompleted,
    filters.dueDate,
    filters.sortBy,
    filters.order,
    pageDetails.currentPage,
    perPage,
  ]);

  const handleConfirmDelete = (id: number) =>
    setSelectedDeleteTask(tasks?.find((t) => t.id === id) || null);

  const closeDeletePopup = () => setSelectedDeleteTask(null);

  async function handleDelete(id: number) {
    if (!tasks) {
      return;
    }
    const prevTasks = tasks;
    const prevPageDetails = pageDetails;

    setTasks((prev) => (prev ? prev.filter((task) => task.id !== id) : null));
    const totalItems = pageDetails.totalItems - 1;
    const totalPages = Math.ceil(perPage ? totalItems / perPage : 1);
    const currentPage = Math.min(pageDetails.currentPage, totalPages);

    try {
      await taskService.delete(id);
      setPageDetails((prev) => ({
        ...prev,
        totalItems,
        totalPages,
        currentPage,
      }));
      // cannot do optimistic update as changing current page before delete refetches all tasks before delete occurs
      // causing totalPages to be wrong
    } catch (err) {
      console.log(err);
      setTasks(prevTasks);
      setPageDetails(prevPageDetails);
    }
  }

  const handleConfirmEdit = (id: number) =>
    setSelectedEditTask(tasks?.find((t) => t.id === id) || null);

  const closeEditPopup = () => setSelectedEditTask(null);

  async function handleEdit(newTask: CreateTaskInput) {
    if (!selectedEditTask || !tasks) return;

    const rawData = {
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      category: newTask.category,
      dueDate: newTask.dueDate,
      estimatedTime: newTask.estimatedTime,
    };

    const patchData: Partial<Task> = Object.fromEntries(
      Object.entries(rawData).filter(([, value]) => value !== ""),
    );

    try {
      await updateTask(selectedEditTask.id, patchData);
      setSelectedEditTask(null);
    } catch (err) {
      console.error("Update failed:", err);
      throw err;
    }
  }

  async function updateTask(id: number, newTaskData: Partial<Task>) {
    if (!tasks) return;
    const prevTasks = tasks;

    try {
      const oldTask = tasks.find((t) => t.id === id);

      if (!oldTask) {
        throw Error("Task doesn't exist");
      }
      const updatedTask: Task = {
        ...oldTask,
        ...newTaskData,
      };

      setTasks(tasks.map((t) => (t.id === updatedTask.id ? updatedTask : t)));

      await taskService.update(id, newTaskData);
    } catch (err) {
      setTasks(prevTasks);
      console.error("Update failed:", err);
      throw err;
    }
  }


  async function setIsCompleted(id: number, isCompleted: boolean) {
    const prevTasks = tasks;
    const completedAt = isCompleted 
    ? new Date().toISOString().slice(0, 19).replace('T', ' ') 
    : null;

    try {
      setTasks(
        (prev) =>
          prev &&
          prev.map((task) =>
            task.id === id ? { ...task, isCompleted, completedAt } : task,
          )
      );

      await taskService.update(id, { 
        isCompleted, 
        completedAt 
      });

    } catch (err) {
      console.log(err)
      setTasks(prevTasks);
    }
}
  const updateFilters = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setPageDetails({ ...pageDetails, currentPage: 1 });
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  function resetFilters() {
    setFilters({
      search: "",
      category: "",
      duration: "",
      isCompleted: "",
      dueDate: "",
      sortBy: "due_date",
      order: "asc",
    });
  }

  function setPage(page: number) {
    setPageDetails((prev) => ({ ...prev, currentPage: page }));
  }

  const isStale = isLoading || filters.search !== deferredSearch;

  const isSearching =
    !!filters.search.trim() ||
    !!filters.category ||
    !!filters.duration ||
    !!filters.isCompleted ||
    !!filters.dueDate;

  return {
    tasks,
    isLoading,
    error,
    selectedDeleteTask,
    selectedEditTask,
    handleConfirmDelete,
    handleDelete,
    closeDeletePopup,
    handleConfirmEdit,
    handleEdit,
    closeEditPopup,
    setIsCompleted,
    updateTask,
    filters,
    pageDetails,
    updateFilters,
    resetFilters,
    setPage,
    isStale,
    isSearching,
  };
}
