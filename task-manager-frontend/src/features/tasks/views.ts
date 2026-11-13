import { Views, type View } from "react-big-calendar";

export const TASK_VIEWS = [
  { value: "all", label: "All tasks" },
  { value: "inbox", label: "Inbox" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
] as const;

export type TaskView = (typeof TASK_VIEWS)[number]["value"];
export const TASK_LAYOUTS = ["list", "calendar", "matrix", "kanban"] as const;
export type TaskLayout = (typeof TASK_LAYOUTS)[number];
export type CountedView = Exclude<TaskView, "all">;
export type TaskViewCounts = Record<CountedView, number>;

export const DEFAULT_VIEW: TaskView = "all";

const VIEW_VALUES: readonly string[] = TASK_VIEWS.map((view) => view.value);

export const isTaskLayout = (value: string | null): value is TaskLayout =>
  TASK_LAYOUTS.some((layout) => layout === value);

export const isTaskView = (value: string | null): value is TaskView =>
  value !== null && VIEW_VALUES.includes(value);

/** Smart views the calendar shows as a span, mapped to its own zoom level. */
const CALENDAR_ZOOM: Partial<Record<TaskView, View>> = {
  today: Views.DAY,
  week: Views.WEEK,
};

export const calendarZoomFor = (view: TaskView): View =>
  CALENDAR_ZOOM[view] ?? Views.MONTH;

/** Ranged views are resolved by the server from the viewer's zone, so no dates are sent. */
export const RANGED_VIEWS: readonly TaskView[] = [
  "today",
  "upcoming",
  "week",
  "month",
];

export const isRangedView = (view: TaskView): boolean =>
  RANGED_VIEWS.includes(view);
