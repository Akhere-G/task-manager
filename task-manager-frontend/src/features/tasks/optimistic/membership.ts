import { addDays, isWithinInterval, parseISO, startOfDay } from "date-fns";

import type { Project } from "../../projects/types";
import { descendantIds } from "../../projects/utils";
import type { MoveInput } from "../api";
import type { Task } from "../types";
import { calendarRange, taskMinutes } from "../utils";
import type { ListQuery } from "./listQueries";

const SHORT_TASK_MINUTES = 30;

const MEMBERSHIP_FIELDS = [
  "isCompleted",
  "priority",
  "projectId",
  "columnId",
  "labelIds",
  "startAt",
  "endAt",
] as const;

export interface MembershipContext {
  projects: Project[];
  now: Date;
}

export const sameMembership = (before: Task, after: Task) =>
  MEMBERSHIP_FIELDS.every(
    (field) => String(before[field]) === String(after[field]),
  );

const completionAllows = (task: Task, filter: string) =>
  filter === "true" || filter === "false"
    ? task.isCompleted === (filter === "true")
    : true;

const priorityAllows = (task: Task, filter: string) =>
  !filter || filter.split(",").includes(String(task.priority));

const labelAllows = (task: Task, filter: string) =>
  !filter || filter.split(",").some((id) => task.labelIds.includes(Number(id)));

const projectAllows = (task: Task, filter: string, projects: Project[]) => {
  if (!filter) return true;
  const id = Number(filter);
  return (
    task.projectId !== null &&
    [id, ...descendantIds(projects, id)].includes(task.projectId)
  );
};

const columnAllows = (
  task: Task,
  { column, unassigned }: ListQuery["params"],
) => {
  if (unassigned === "true") return task.columnId === null;
  return !column || task.columnId === Number(column);
};

const durationAllows = (task: Task, filter: string) => {
  if (!filter) return true;
  if (!task.startAt || !task.endAt) return false;
  const isShort = taskMinutes(task) <= SHORT_TASK_MINUTES;
  return filter === "short_tasks" ? isShort : !isShort;
};

const groupAllows = (task: Task, group: string | undefined, now: Date) => {
  if (!group) return true;
  if (group === "completed") return task.isCompleted;
  if (task.isCompleted) return false;
  if (!task.endAt) return group === "undated";
  const end = parseISO(task.endAt);
  const tomorrow = startOfDay(addDays(now, 1));
  if (group === "overdue") return end < now;
  if (group === "today") return end >= now && end < tomorrow;
  return group === "upcoming" && end >= tomorrow;
};

const rangeAllows = (task: Task, { filters, isCalendar }: ListQuery) =>
  !isCalendar ||
  (!!task.endAt &&
    isWithinInterval(parseISO(task.endAt), calendarRange(filters.currentDate)));

export const belongsToList = (
  task: Task,
  list: ListQuery,
  { projects, now }: MembershipContext,
) => {
  const { filters, params, view } = list;
  return (
    completionAllows(task, filters.isCompleted) &&
    priorityAllows(task, filters.priority) &&
    labelAllows(task, filters.label) &&
    projectAllows(task, params.project ?? filters.project, projects) &&
    columnAllows(task, params) &&
    durationAllows(task, filters.duration) &&
    (view !== "inbox" || task.projectId === null) &&
    groupAllows(task, params.group, now) &&
    rangeAllows(task, list)
  );
};

const sortValue = (task: Task, sortBy: string): number | string | null => {
  if (sortBy === "title") return task.title.toLowerCase();
  if (sortBy === "priority") return task.priority;
  if (sortBy === "created_at") return Date.parse(task.createdAt);
  if (sortBy === "duration") {
    return task.startAt && task.endAt ? taskMinutes(task) : null;
  }
  if (sortBy === "manual") return task.position;
  return task.startAt ? Date.parse(task.startAt) : null;
};

const compareValues = (
  a: number | string | null,
  b: number | string | null,
  order: string,
) => {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const ascending =
    typeof a === "string" ? a.localeCompare(String(b)) : a - Number(b);
  return order === "desc" ? -ascending : ascending;
};

export const sortsDifferently = (
  before: Task,
  after: Task,
  { filters }: ListQuery,
) => sortValue(before, filters.sortBy) !== sortValue(after, filters.sortBy);

const droppedIndex = (tasks: Task[], { afterId, beforeId }: MoveInput) => {
  const after = tasks.findIndex((task) => task.id === afterId);
  if (after >= 0) return after + 1;
  return Math.max(
    tasks.findIndex((task) => task.id === beforeId),
    0,
  );
};

export const insertIndex = (
  tasks: Task[],
  task: Task,
  { filters }: ListQuery,
  placement?: MoveInput,
) => {
  if (placement) return droppedIndex(tasks, placement);
  const { sortBy, order } = filters;
  if (sortBy === "manual") return 0;
  const index = tasks.findIndex(
    (other) =>
      compareValues(sortValue(task, sortBy), sortValue(other, sortBy), order) <
      0,
  );
  return index < 0 ? tasks.length : index;
};
