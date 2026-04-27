import { createContext, useContext, useState } from "react";
import type { CreateTaskInput, Task } from "../features/tasks/types";
import { taskService } from "../services/api";
import { useQueryClient } from "@tanstack/react-query";
import { statsQueryKeys } from "../features/stats/constants";
import { addDays, addMonths, addWeeks, addYears, format } from "date-fns";
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
  handleDelete: (id: number) => Promise<void>;
  handleEdit: (newTask: CreateTaskInput) => Promise<void>;
  skipTask: (task: Task) => void;
  updateTask: (id: number, newTaskData: Partial<Task>) => Promise<void>;
  setIsCompleted: (id: number, isCompleted: boolean) => Promise<void>;
  openPopup: (task: Task, mode: PopupMode) => void;
  closePopup: () => void;
  selectedTask: Task | null;
  popupMode: PopupMode;
}

const TaskContext = createContext<TaskContextType | null>(null);
export const PopupModes = {
  Edit: "Edit",
  Delete: "Delete",
  View: "View",
  Closed: "Closed",
} as const;

export type PopupMode = keyof typeof PopupModes;

export default function TaskContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [popupMode, setPopupMode] = useState<PopupMode>(PopupModes.Closed);

  const queryKeysAffectedByMutations = ["tasks", ...statsQueryKeys];
  const invalidateKeys = () =>
    queryKeysAffectedByMutations.forEach((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    );

  async function handleDelete(id: number) {
    try {
      await taskService.delete(id);
      invalidateKeys();
    } catch (err) {
      console.error(err);
    }
  }

  const openPopup = (task: Task, mode: PopupMode) => {
    setSelectedTask(task);
    setPopupMode(mode);
  };

  const closePopup = () => {
    setPopupMode(PopupModes.Closed);
    setSelectedTask(null);
  };

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
    if (!selectedTask) return;
    const rawData = {
      ...newTask,
      title: newTask.title.trim(),
      description: newTask.description?.trim(),
      category: newTask.category,
      startAt: newTask.startAt,
      endAt: newTask.endAt,
    };

    const patchData: Partial<Task> = Object.fromEntries(
      Object.entries(rawData).filter(([, value]) => value !== ""),
    );

    try {
      await updateTask(selectedTask.id, patchData);
      closePopup();
    } catch (err) {
      console.error("Update failed:", err);
      throw err;
    }
  }

  function skipDate(date: Date, repeatBy: string) {
    switch (repeatBy) {
      case "daily":
        return addDays(date, 1);
      case "weekly":
        return addWeeks(date, 1);
      case "monthly":
        return addMonths(date, 1);
      case "yearly":
        return addYears(date, 1);
    }
    throw new Error(
      'Repeat by must be one of: "daily", "weekly", "monthly", "yearly"',
    );
  }

  async function skipTask(task: Task) {
    try {
      if (!task.repeatBy) return;

      const startAt = new Date(task.startAt);
      const endAt = new Date(task.endAt);

      const newStartAt = skipDate(startAt, task.repeatBy);
      const newEndAt = skipDate(endAt, task.repeatBy);

      await updateTask(task.id, {
        startAt: format(newStartAt, "yyyy-MM-dd HH:mm"),
        endAt: format(newEndAt, "yyyy-MM-dd HH:mm"),
      });
    } catch (err) {
      console.log(err);
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
    handleEdit,
    handleDelete,
    setIsCompleted,
    updateTask,
    selectedTask,
    openPopup,
    closePopup,
    popupMode,
    skipTask,
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
