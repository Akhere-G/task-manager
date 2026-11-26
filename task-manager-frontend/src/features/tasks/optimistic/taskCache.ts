import type { QueryClient, QueryKey } from "@tanstack/react-query";

import type { Project } from "../../projects/types";
import type { GetTaskResult, MoveInput } from "../api";
import type { Subtask, Task } from "../types";
import { taskMinutes } from "../utils";
import { listQueryOf, type ListQuery } from "./listQueries";
import {
  belongsToList,
  insertIndex,
  sameMembership,
  sortsDifferently,
  type MembershipContext,
} from "./membership";
import {
  insertedAt,
  readPages,
  replaced,
  restored,
  tasksOf,
  withItemAt,
  without,
  withTotals,
  writePages,
  type Totals,
} from "./pages";

export interface TaskChange {
  taskId: number;
  change: (task: Task) => Task | null;
  placement?: MoveInput;
}

export interface CachePatch {
  queryKeys: QueryKey[];
  undo: () => void;
}

interface Edit {
  current: Task;
  next: Task | null;
  isLoaded: boolean;
}

interface ListState {
  list: ListQuery;
  context: MembershipContext;
  placement?: MoveInput;
}

const detailKey = (id: number) => ["tasks", { id }];

const listQueries = (queryClient: QueryClient, type: "active" | "all") =>
  queryClient.getQueriesData({ queryKey: ["tasks"], type });

export const findCachedTask = (queryClient: QueryClient, taskId: number) => {
  const listed = (type: "active" | "all") =>
    listQueries(queryClient, type)
      .flatMap(([queryKey, data]) =>
        listQueryOf(queryKey) ? tasksOf(readPages(data) ?? []) : [],
      )
      .find((task) => task.id === taskId);
  return (
    listed("active") ??
    queryClient.getQueryData<Task>(detailKey(taskId)) ??
    listed("all")
  );
};

const withSharedFields = (ghost: Task, edited: Task): Task => {
  const { title, description, priority, projectId } = edited;
  const isUnchanged =
    ghost.title === title &&
    ghost.description === description &&
    ghost.priority === priority &&
    ghost.projectId === projectId;
  return isUnchanged
    ? ghost
    : { ...ghost, title, description, priority, projectId };
};

const editsFor = (
  pages: GetTaskResult[],
  { taskId, change }: TaskChange,
  cached: Task | undefined,
): Edit[] => {
  const loaded = tasksOf(pages);
  const target = loaded.find((task) => task.id === taskId);
  const current = target ?? cached;
  const ghosts = loaded.filter(
    (task) => task.isGhost && task.seriesId === taskId,
  );
  return [
    ...(current
      ? [{ current, next: change(current), isLoaded: !!target }]
      : []),
    ...ghosts.map((ghost) => {
      const edited = change(ghost);
      return {
        current: ghost,
        next: edited && withSharedFields(ghost, edited),
        isLoaded: true,
      };
    }),
  ];
};

const presence = (
  pages: GetTaskResult[],
  { current, next, isLoaded }: Edit,
  { list, context }: ListState,
) => {
  const isPartial = tasksOf(pages).length < (pages.at(-1)?.totalTasks ?? 0);
  const was = isLoaded || (isPartial && belongsToList(current, list, context));
  if (!next) return { was, will: false };
  if (sameMembership(current, next)) return { was, will: was };
  return { was, will: belongsToList(next, list, context) };
};

const applyEdit = (
  pages: GetTaskResult[],
  edit: Edit,
  state: ListState,
): { pages: GetTaskResult[]; totals: Totals } => {
  const { current, next, isLoaded } = edit;
  const { was, will } = presence(pages, edit, state);
  const totals = {
    tasks: Number(will) - Number(was),
    minutes:
      (will && next ? taskMinutes(next) : 0) - (was ? taskMinutes(current) : 0),
  };
  const ids = new Set([current.id]);

  if (!will || !next) {
    return { pages: without(pages, ids), totals };
  }
  const moves =
    state.placement !== undefined ||
    sortsDifferently(current, next, state.list);
  if (isLoaded && !moves) return { pages: replaced(pages, next), totals };
  if (!isLoaded && was) return { pages, totals };

  const rest = without(pages, ids);
  const index = insertIndex(tasksOf(rest), next, state.list, state.placement);
  return { pages: insertedAt(rest, next, index), totals };
};

const patchList = (
  queryClient: QueryClient,
  queryKey: QueryKey,
  taskChange: TaskChange,
  cached: Task | undefined,
  state: ListState,
): (() => void) | null => {
  const data = queryClient.getQueryData(queryKey);
  const pages = readPages(data);
  if (!pages) return null;
  const edits = editsFor(pages, taskChange, cached).filter(
    ({ current, next }) => next !== current,
  );

  let patched = pages;
  const totals = { tasks: 0, minutes: 0 };
  for (const edit of edits) {
    const result = applyEdit(patched, edit, state);
    patched = withTotals(result.pages, result.totals);
    totals.tasks += result.totals.tasks;
    totals.minutes += result.totals.minutes;
  }

  const ids = new Set(edits.map((edit) => edit.current.id));
  const before = tasksOf(pages);
  const previous = before.filter((task) => ids.has(task.id));
  const isShown = tasksOf(patched).some((task) => ids.has(task.id));
  if (!previous.length && !isShown && !totals.tasks && !totals.minutes) {
    return null;
  }

  queryClient.setQueryData(queryKey, writePages(data, patched));

  const originalIds = before.map((task) => task.id);
  return () => {
    queryClient.setQueryData(queryKey, (latest: unknown) => {
      const latestPages = readPages(latest);
      if (!latestPages) return latest;
      const withPrevious = previous.reduce(
        (result, task) => restored(result, task, originalIds),
        without(latestPages, ids),
      );
      return writePages(
        latest,
        withTotals(withPrevious, {
          tasks: -totals.tasks,
          minutes: -totals.minutes,
        }),
      );
    });
  };
};

const patchDetail = (
  queryClient: QueryClient,
  { taskId, change }: TaskChange,
): (() => void) | null => {
  const queryKey = detailKey(taskId);
  const previous = queryClient.getQueryData<Task>(queryKey);
  const next = previous && change(previous);
  if (!next || next === previous) return null;
  queryClient.setQueryData(queryKey, next);
  return () => {
    queryClient.setQueryData(queryKey, previous);
  };
};

export const patchTask = (
  queryClient: QueryClient,
  taskChange: TaskChange,
): CachePatch => {
  const cached = findCachedTask(queryClient, taskChange.taskId);
  const context = {
    projects: queryClient.getQueryData<Project[]>(["projects"]) ?? [],
    now: new Date(),
  };
  const queryKeys: QueryKey[] = [];
  const undos: (() => void)[] = [];
  const record = (queryKey: QueryKey, undo: (() => void) | null) => {
    if (!undo) return;
    queryKeys.push(queryKey);
    undos.push(undo);
  };

  for (const [queryKey] of listQueries(queryClient, "active")) {
    const list = listQueryOf(queryKey);
    if (!list) continue;
    const state = { list, context, placement: taskChange.placement };
    record(
      queryKey,
      patchList(queryClient, queryKey, taskChange, cached, state),
    );
  }
  record(detailKey(taskChange.taskId), patchDetail(queryClient, taskChange));

  return { queryKeys, undo: () => undos.forEach((undo) => undo()) };
};

const withSubtask = (
  parent: Task,
  from: Subtask,
  to: Subtask | null,
  index: number,
): Task => {
  const others = parent.subtasks?.filter((subtask) => subtask.id !== from.id);
  return {
    ...parent,
    subtasks: to && others ? withItemAt(others, index, to) : others,
  };
};

const counted = (
  parent: Task,
  from: Subtask | null,
  to: Subtask | null,
): Task => ({
  ...parent,
  subtaskCount: parent.subtaskCount + Number(!!to) - Number(!!from),
  subtaskCompletedCount:
    parent.subtaskCompletedCount +
    Number(to?.isCompleted ?? false) -
    Number(from?.isCompleted ?? false),
});

export const patchSubtask = (
  queryClient: QueryClient,
  parentId: number,
  subtaskId: number,
  change: (subtask: Subtask) => Subtask | null,
): CachePatch => {
  const subtasks =
    queryClient.getQueryData<Task>(detailKey(parentId))?.subtasks ?? [];
  const index = subtasks.findIndex((subtask) => subtask.id === subtaskId);
  const previous = subtasks[index];
  if (!previous) return { queryKeys: [], undo: () => {} };
  const next = change(previous);

  const swap = (from: Subtask | null, to: Subtask | null) =>
    patchTask(queryClient, {
      taskId: parentId,
      change: (parent) =>
        withSubtask(counted(parent, from, to), previous, to, index),
    });

  const { queryKeys } = swap(previous, next);
  return {
    queryKeys,
    undo: () => {
      swap(next, previous);
    },
  };
};

const withOrder = (pages: GetTaskResult[], reordered: Task[]) => {
  let offset = 0;
  return pages.map((page) => {
    const tasks = reordered.slice(offset, offset + page.tasks.length);
    offset += page.tasks.length;
    return { ...page, tasks };
  });
};

export const reorderList = (
  queryClient: QueryClient,
  queryKey: QueryKey,
  movedId: number,
  reordered: Task[],
): CachePatch => {
  const data = queryClient.getQueryData(queryKey);
  const pages = readPages(data);
  const before = tasksOf(pages ?? []);
  const moved = before.find((task) => task.id === movedId);
  if (!pages || !moved) return { queryKeys: [], undo: () => {} };
  queryClient.setQueryData(
    queryKey,
    writePages(data, withOrder(pages, reordered)),
  );

  const originalIds = before.map((task) => task.id);
  return {
    queryKeys: [queryKey],
    undo: () => {
      queryClient.setQueryData(queryKey, (latest: unknown) => {
        const latestPages = readPages(latest);
        if (!latestPages) return latest;
        const rest = without(latestPages, new Set([movedId]));
        return writePages(latest, restored(rest, moved, originalIds));
      });
    },
  };
};
