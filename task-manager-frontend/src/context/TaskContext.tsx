import { createContext, useContext, useState } from "react";
import type { CreateTaskInput, Task } from "../features/tasks/types";
import { taskService } from "../services/api";
import { useQueryClient } from "@tanstack/react-query";
import { statsQueryKeys } from "../features/stats/constants";
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
  selectedEditTask: Task | null;
  selectedDeleteTask: Task | null;
  handleConfirmDelete: (task: Task) => void;
  closeDeletePopup: () => void;
  handleDelete: (id: number) => Promise<void>;
  handleConfirmEdit: (task: Task) => void;
  closeEditPopup: () => void;
  handleEdit: (newTask: CreateTaskInput) => Promise<void>;
  updateTask: (id: number, newTaskData: Partial<Task>) => Promise<void>;
  setIsCompleted: (id: number, isCompleted: boolean) => Promise<void>;
}

const TaskContext = createContext<TaskContextType | null>(null);

export default function TaskContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();

  const [selectedEditTask, setSelectedEditTask] = useState<Task | null>(null);
  const [selectedDeleteTask, setSelectedDeleteTask] = useState<Task | null>(
    null,
  );

  const queryKeysAffectedByMutations = ["tasks", ...statsQueryKeys];
  const invalidateKeys = () =>
    queryKeysAffectedByMutations.forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    );

  const handleConfirmDelete = (task: Task) => setSelectedDeleteTask(task);

  const closeDeletePopup = () => setSelectedDeleteTask(null);

  async function handleDelete(id: number) {
    try {
      await taskService.delete(id);
      invalidateKeys();
    } catch (err) {
      console.error(err);
    }
  }

  const handleConfirmEdit = (task: Task) => setSelectedEditTask(task);

  const closeEditPopup = () => setSelectedEditTask(null);

  async function updateTask(id: number, newTaskData: Partial<Task>) {
    try {
      await taskService.update(id, newTaskData);
      invalidateKeys();
    } catch (err) {
      console.error("Update failed:", err);
      throw err;
    }
  }

  async function handleEdit(newTask: CreateTaskInput) {
    if (!selectedEditTask) return;
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

  async function setIsCompleted(id: number, isCompleted: boolean) {
    const completedAt = isCompleted
      ? new Date().toISOString().slice(0, 19).replace("T", " ")
      : null;

    try {
      await taskService.update(id, { isCompleted, completedAt });
      invalidateKeys();
    } catch (err) {
      console.error(err);
    }
  }

  const value = {
    selectedEditTask,
    selectedDeleteTask,
    handleConfirmEdit,
    handleConfirmDelete,
    handleEdit,
    handleDelete,
    closeEditPopup,
    closeDeletePopup,
    setIsCompleted,
    updateTask,
  };

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>;
}

export const useTaskContext = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error("useTaskContext must be used within a TaskContextProvider");
  }
  return context;
};
