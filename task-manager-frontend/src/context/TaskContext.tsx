import { createContext, useContext, useState } from "react";
import type { Task } from "../features/tasks/types";

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
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [popupMode, setPopupMode] = useState<PopupMode>(PopupModes.Closed);

  const openPopup = (task: Task, mode: PopupMode) => {
    setSelectedTask(task);
    setPopupMode(mode);
  };

  const closePopup = () => {
    setPopupMode(PopupModes.Closed);
    setSelectedTask(null);
  };

  const value = {
    selectedTask,
    openPopup,
    closePopup,
    popupMode,
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
