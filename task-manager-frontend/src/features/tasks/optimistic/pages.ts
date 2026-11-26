import type { InfiniteData } from "@tanstack/react-query";

import type { GetTaskResult } from "../api";
import type { Task } from "../types";
import { isRecord } from "./listQueries";

export interface Totals {
  tasks: number;
  minutes: number;
}

const isResult = (data: unknown): data is GetTaskResult =>
  isRecord(data) && Array.isArray(data.tasks);

const isInfinite = (data: unknown): data is InfiniteData<GetTaskResult> =>
  isRecord(data) && Array.isArray(data.pages) && data.pages.every(isResult);

export const readPages = (data: unknown): GetTaskResult[] | null => {
  if (isInfinite(data)) return data.pages;
  return isResult(data) ? [data] : null;
};

export const writePages = (data: unknown, pages: GetTaskResult[]) =>
  isInfinite(data) ? { ...data, pages } : pages[0];

export const tasksOf = (pages: GetTaskResult[]) =>
  pages.flatMap((page) => page.tasks);

export const without = (pages: GetTaskResult[], ids: ReadonlySet<number>) =>
  pages.map((page) => ({
    ...page,
    tasks: page.tasks.filter((task) => !ids.has(task.id)),
  }));

export const replaced = (pages: GetTaskResult[], next: Task) =>
  pages.map((page) => ({
    ...page,
    tasks: page.tasks.map((task) => (task.id === next.id ? next : task)),
  }));

export const withItemAt = <T>(items: T[], index: number, item: T) => [
  ...items.slice(0, index),
  item,
  ...items.slice(index),
];

export const insertedAt = (
  pages: GetTaskResult[],
  task: Task,
  flatIndex: number,
) => {
  let index = flatIndex;
  let page = 0;
  while (page < pages.length - 1 && index > pages[page].tasks.length) {
    index -= pages[page].tasks.length;
    page += 1;
  }
  return pages.map((current, position) =>
    position === page
      ? { ...current, tasks: withItemAt(current.tasks, index, task) }
      : current,
  );
};

export const restored = (
  pages: GetTaskResult[],
  task: Task,
  originalIds: number[],
) => {
  const preceding = originalIds.slice(0, originalIds.indexOf(task.id));
  const present = tasksOf(pages).map(({ id }) => id);
  const anchor = preceding.reverse().find((id) => present.includes(id));
  const index = anchor === undefined ? 0 : present.indexOf(anchor) + 1;
  return insertedAt(pages, task, index);
};

export const withTotals = (pages: GetTaskResult[], change: Totals) =>
  pages.map((page) => ({
    ...page,
    totalTasks: page.totalTasks + change.tasks,
    totalMinutes: page.totalMinutes + change.minutes,
  }));
