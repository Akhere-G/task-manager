import type { TaskFilters } from "./taskParams";

export type TaskGroupId =
  "overdue" | "today" | "upcoming" | "undated" | "completed";

interface TaskGroupDefinition {
  id: TaskGroupId;
  title: string;
  isUrgent?: boolean;
  /** Shown beside the title instead of the group's total time. */
  hint?: string;
  /** Replaces the list's own sort for this group. */
  sortOverrides?: Partial<TaskFilters>;
}

export const TASK_GROUPS: readonly TaskGroupDefinition[] = [
  {
    id: "overdue",
    title: "Overdue",
    isUrgent: true,
    hint: "Needs rescheduling or completion",
  },
  { id: "today", title: "Today" },
  { id: "upcoming", title: "Upcoming" },
  { id: "undated", title: "No date" },
  {
    id: "completed",
    title: "Completed",
    sortOverrides: { sortBy: "start_at", order: "desc" },
  },
];

export type { TaskGroupDefinition };
