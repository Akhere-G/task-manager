import { createContext, useContext, useDeferredValue, useState } from "react";
import type { CreateTaskInput, Task } from "../features/tasks/types";
import { formatDate } from "../features/tasks/utils";
import { taskService } from "../services/api";

export interface PageDetails {
  currentPage: number;
  totalItems: number;
  totalPages: number;
}

export interface TaskFilters {
  search: string;
  category: string;
  duration: string;
  isCompleted: string;
  dueDate: string;
  sortBy: string;
  order: string;
}

export interface TaskContextType {
  // Data and Loading States
  tasks: Task[] | null;
  isLoading: boolean;
  error: string | null;
  
  // UI States (Popups/Modals)
  selectedDeleteTask: Task | null;
  selectedEditTask: Task | null;
  
  // Helper Logic States
  isStale: boolean;
  isSearching: boolean;
  
  // Pagination and Filtering
  pageDetails: PageDetails;
  filters: TaskFilters;
  deferredSearch: string;
  
  // handlers for fetching
  fetchTasks:(perPage: number | null) => Promise<void>; 

  // Handlers for Deleting
  handleConfirmDelete: (id: number) => void;
  handleDelete: (id: number) => Promise<void>;
  closeDeletePopup: () => void;
  
  // Handlers for Editing
  handleConfirmEdit: (id: number) => void;
  handleEdit: (newTask: CreateTaskInput) => Promise<void>;
  closeEditPopup: () => void;
  
  // State Update Actions
  updateTask: (id: number, newTaskData: Partial<Task>) => Promise<void>;
  setIsCompleted: (id: number, isCompleted: boolean) => Promise<void>;
  updateFilters: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;
  resetFilters: () => void;
  setPage: (page: number) => void;
}

const TaskContext = createContext<TaskContextType | null>(null)

export default function TaskContextProvider  ({ children }: { children: React.ReactNode }) {
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
    const [perPage, setPerPage] = useState<number | null>(10)
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
  
    async function fetchTasks(perPage: number | null) {
        setPerPage(perPage)
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
            currentPage: (totalPages < prev.currentPage && totalPages > 0) ? totalPages : prev.currentPage
          }));
          setError(null);
        } catch (err) {
          setError("Couldn't load tasks.");
          console.log(err);
        } finally {
          setIsLoading(false);
        }
      }
  
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
      
      try {
        await taskService.delete(id);
        

        await fetchTasks(perPage)

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
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setPageDetails({ ...pageDetails, currentPage: 1 });
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };
  
  function resetFilters() {
    setFilters({
      search: "",
      category: "",
      duration: "",
      isCompleted: "false",
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
    filters.isCompleted !== 'false' ||
    !!filters.dueDate;

  const value = {
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
    deferredSearch,
    fetchTasks
  };

  return (
    <TaskContext.Provider value={value}>
      {children}
    </TaskContext.Provider>
  )
}

export const useTaskContext = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error("useTaskContext must be used within a TaskContextProvider");
  }
  return context;
};