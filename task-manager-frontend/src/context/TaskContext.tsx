import { createContext, useContext, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { FormErrors } from "../features/tasks/formErrors";
import type { Task } from "../features/tasks/types";
import { taskTargetId } from "../features/tasks/utils";

export interface TaskFilters {
  search: string;
  project: string;
  label: string;
  duration: string;
  isCompleted: string;
  sortBy: string;
  order: string;
}

export interface TaskContextType {
  openPopup: (task: Task, mode: PopupMode) => void;
  closePopup: () => void;
  reopenEdit: (draft: Task, errors: FormErrors) => void;
  editErrors?: FormErrors;
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

interface PopupState {
  task: Task | null;
  mode: PopupMode;
  errors?: FormErrors;
}

const CLOSED_POPUP: PopupState = { task: null, mode: PopupModes.Closed };

export default function TaskContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [popup, setPopup] = useState(CLOSED_POPUP);

  const [searchParams, setSearchParams] = useSearchParams();

  const setTaskParam = (taskId: number | null) => {
    const next = new URLSearchParams(searchParams);
    if (taskId === null) next.delete("task");
    else next.set("task", String(taskId));
    setSearchParams(next, { replace: true });
  };

  const openPopup = (task: Task, mode: PopupMode) => {
    setPopup({ task, mode });
    if (mode === PopupModes.View) {
      setTaskParam(taskTargetId(task));
    }
  };

  const closePopup = () => {
    setPopup(CLOSED_POPUP);
    setTaskParam(null);
  };

  const reopenEdit = (draft: Task, errors: FormErrors) => {
    setPopup((current) =>
      current.mode === PopupModes.Closed
        ? { task: draft, mode: PopupModes.Edit, errors }
        : current,
    );
  };

  const value = {
    selectedTask: popup.task,
    popupMode: popup.mode,
    editErrors: popup.errors,
    openPopup,
    closePopup,
    reopenEdit,
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
