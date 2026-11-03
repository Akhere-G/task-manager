import { Views, type View } from "react-big-calendar";

export const TASK_VIEWS = [
  { value: "inbox", label: "Inbox" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
] as const;

export type TaskView = (typeof TASK_VIEWS)[number]["value"];
export type TaskLayout = "list" | "calendar";
export type TaskViewCounts = Record<TaskView, number>;

export const DEFAULT_VIEW: TaskView = "today";

const VIEW_VALUES: readonly string[] = TASK_VIEWS.map((view) => view.value);

export const isTaskView = (value: string | null): value is TaskView =>
  value !== null && VIEW_VALUES.includes(value);

/** Smart views the calendar shows as a span, mapped to its own zoom level. */
const CALENDAR_ZOOM: Partial<Record<TaskView, View>> = {
  today: Views.DAY,
  week: Views.WEEK,
};

export const calendarZoomFor = (view: TaskView): View =>
  CALENDAR_ZOOM[view] ?? Views.MONTH;

/** Ranged views are resolved by the server, so the client sends no dates for them. */
export const RANGED_VIEWS: readonly TaskView[] = [
  "today",
  "upcoming",
  "week",
  "month",
];
