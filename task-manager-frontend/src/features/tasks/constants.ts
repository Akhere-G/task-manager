import type { Priority } from "./types";

export const priorityOptions = [
  { name: "P1 · Urgent", value: "1" },
  { name: "P2 · High", value: "2" },
  { name: "P3 · Medium", value: "3" },
  { name: "P4 · None", value: "4" },
];

export const priorityFilterOptions = [
  { name: "All", value: "" },
  { name: "P1", value: "1" },
  { name: "P1–P2", value: "1,2" },
  { name: "P1–P3", value: "1,2,3" },
  { name: "P4", value: "4" },
];

export const priorityColours: Record<number, string> = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-blue-500",
};

export const priorityBadgeClasses: Record<Priority, string> = {
  1: "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  2: "bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-400",
  3: "bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  4: "bg-surface-muted text-text-sub",
};

export const priorityBadgeSolidClasses: Record<Priority, string> = {
  1: "bg-red-500 text-white",
  2: "bg-orange-500 text-white",
  3: "bg-blue-600 text-white",
  4: "bg-slate-500 text-white",
};

export const quadrantPanelClasses: Record<Priority, string> = {
  1: "border-red-200 bg-red-50/40 dark:border-red-500/30 dark:bg-red-500/5",
  2: "border-orange-200 bg-orange-50/40 dark:border-orange-500/30 dark:bg-orange-500/5",
  3: "border-blue-200 bg-blue-50/40 dark:border-blue-500/30 dark:bg-blue-500/5",
  4: "border-slate-200 bg-surface dark:border-slate-700",
};

export const priorityRingClasses: Record<Priority, string> = {
  1: "border-red-500",
  2: "border-orange-500",
  3: "border-blue-500",
  4: "border-slate-300 dark:border-slate-600",
};

export const matrixQuadrants: {
  priority: Priority;
  title: string;
  description: string;
}[] = [
  { priority: 1, title: "Do first", description: "Urgent and important" },
  { priority: 2, title: "Schedule", description: "Important, not urgent" },
  { priority: 3, title: "Delegate", description: "Urgent, not important" },
  { priority: 4, title: "Eliminate", description: "Neither urgent nor important" },
];

export const taskDurationOptions = [
  { name: "All", value: "" },
  { name: "Short", value: "short_tasks" },
  { name: "Long", value: "long_tasks" },
];

export const completedTasksOptions = [
  { name: "All", value: "all" },
  { name: "Completed", value: "true" },
  { name: "Pending", value: "false" },
];

export const sortByOptions = [
  { name: "Start Date", value: "start_at" },
  { name: "Created At", value: "created_at" },
  { name: "Title", value: "title" },
  { name: "Duration", value: "duration" },
  { name: "Priority", value: "priority" },
  { name: "Manual", value: "manual" },
];

export const isAscOptions = [
  { name: "Ascending", value: "asc" },
  { name: "Descending", value: "desc" },
];
