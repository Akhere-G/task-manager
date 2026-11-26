import {
  addDays,
  addMilliseconds,
  addMinutes,
  differenceInMilliseconds,
  isSaturday,
  nextMonday,
  nextSaturday,
  parseISO,
  set,
} from "date-fns";

import type { SnoozePreset, Task, TaskUpdate } from "../types";

const UNDATED_START = {
  hours: 9,
  minutes: 0,
  seconds: 0,
  milliseconds: 0,
} as const;
const UNDATED_MINUTES = 30;

const toIso = (value: string) => new Date(value).toISOString();

const withIsoDates = ({ startAt, endAt, completedAt }: TaskUpdate) => ({
  ...(startAt ? { startAt: toIso(startAt) } : {}),
  ...(endAt ? { endAt: toIso(endAt) } : {}),
  ...(completedAt ? { completedAt: toIso(completedAt) } : {}),
});

const withSubtasksDone = (task: Task): Task => ({
  ...task,
  subtaskCompletedCount: task.subtaskCount,
  subtasks: task.subtasks?.map((subtask) => ({
    ...subtask,
    isCompleted: true,
  })),
});

export const predictUpdate =
  (update: TaskUpdate) =>
  (task: Task): Task => {
    const next: Task = { ...task, ...update, ...withIsoDates(update) };
    if (update.projectName) next.projectId = task.projectId;
    if (next.projectId !== task.projectId) next.columnId = null;
    const completesParent =
      next.isCompleted && !task.isCompleted && !task.isRepeating;
    return completesParent ? withSubtasksDone(next) : next;
  };

type RelativePreset = Exclude<SnoozePreset, "next_occurrence" | "date">;

const relativeDays: Record<RelativePreset, (today: Date) => Date> = {
  tomorrow: (today) => addDays(today, 1),
  weekend: (today) =>
    isSaturday(today) ? addDays(today, 1) : nextSaturday(today),
  next_week: nextMonday,
};

const snoozedSpan = ({ startAt, endAt }: Task, day: Date) => {
  if (!startAt || !endAt) {
    const start = set(day, UNDATED_START);
    return { start, end: addMinutes(start, UNDATED_MINUTES) };
  }
  const previous = parseISO(startAt);
  const start = set(day, {
    hours: previous.getHours(),
    minutes: previous.getMinutes(),
    seconds: previous.getSeconds(),
    milliseconds: previous.getMilliseconds(),
  });
  const length = differenceInMilliseconds(parseISO(endAt), previous);
  return { start, end: addMilliseconds(start, length) };
};

export const predictSnooze =
  (preset: SnoozePreset, day?: string, now = new Date()) =>
  (task: Task): Task => {
    if (preset === "next_occurrence") return task;
    const target =
      preset === "date" ? parseISO(day ?? "") : relativeDays[preset](now);
    const { start, end } = snoozedSpan(task, target);
    return {
      ...task,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    };
  };
