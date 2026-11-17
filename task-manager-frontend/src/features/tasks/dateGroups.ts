import {
  addDays,
  format,
  isSameDay,
  isBefore,
  parseISO,
  startOfDay,
} from "date-fns";

import type { Task } from "./types";
import { isTaskOverdue, taskMinutes } from "./utils";

export type DateGroupKind =
  "overdue" | "today" | "tomorrow" | "upcoming" | "earlier" | "none";

export interface DateGroup {
  key: string;
  kind: DateGroupKind;
  label: string;
  tasks: Task[];
  totalMinutes: number;
}

const dayLabel = (date: Date) => format(date, "EEE, d MMM");

const describeDay = (start: Date, now: Date) => {
  if (isSameDay(start, now)) {
    return { kind: "today", label: `Today · ${dayLabel(start)}` } as const;
  }
  if (isSameDay(start, addDays(now, 1))) {
    return {
      kind: "tomorrow",
      label: `Tomorrow · ${dayLabel(start)}`,
    } as const;
  }
  if (isBefore(start, startOfDay(now))) {
    return { kind: "earlier", label: dayLabel(start) } as const;
  }
  return { kind: "upcoming", label: `Upcoming · ${dayLabel(start)}` } as const;
};

const describeGroup = (task: Task, now: Date) => {
  if (isTaskOverdue(task, now)) {
    return { key: "overdue", kind: "overdue", label: "Overdue" } as const;
  }
  if (!task.startAt) {
    return { key: "none", kind: "none", label: "No date" } as const;
  }
  const start = parseISO(task.startAt);
  return { key: format(start, "yyyy-MM-dd"), ...describeDay(start, now) };
};

/** Keeps the order tasks arrive in; a group sits where its first task is. */
export const groupTasksByDate = (tasks: Task[], now = new Date()) => {
  const groups = new Map<string, DateGroup>();
  for (const task of tasks) {
    const { key, kind, label } = describeGroup(task, now);
    const group = groups.get(key) ?? {
      key,
      kind,
      label,
      tasks: [],
      totalMinutes: 0,
    };
    group.tasks.push(task);
    group.totalMinutes += taskMinutes(task);
    groups.set(key, group);
  }
  return [...groups.values()];
};
