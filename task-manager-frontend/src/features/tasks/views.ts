export const TASK_VIEWS = ["all", "inbox"] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

export const TASK_LAYOUTS = ["list", "calendar", "matrix", "kanban"] as const;
export type TaskLayout = (typeof TASK_LAYOUTS)[number];

export const DEFAULT_VIEW: TaskView = "all";

export const isTaskLayout = (value: string | null): value is TaskLayout =>
  TASK_LAYOUTS.some((layout) => layout === value);

export const isTaskView = (value: string | null): value is TaskView =>
  TASK_VIEWS.some((view) => view === value);
