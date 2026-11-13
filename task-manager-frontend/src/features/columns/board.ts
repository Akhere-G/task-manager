import { arrayMove } from "@dnd-kit/sortable";
import type { Task } from "../tasks/types";
import type { BoardMoveInput, OnDrop, ProjectColumn } from "./types";

export type TasksByColumn = Map<number, Task[]>;

/** Tasks of a board by column; one without a column sits in the first. */
export function groupByColumn(
  tasks: Task[],
  columns: ProjectColumn[],
): TasksByColumn {
  const groups: TasksByColumn = new Map(
    columns.map((column) => [column.id, []]),
  );
  const firstId = columns[0]?.id;
  tasks.forEach((task) => {
    const id =
      task.columnId !== null && groups.has(task.columnId)
        ? task.columnId
        : firstId;
    if (id !== undefined) groups.get(id)?.push(task);
  });
  return groups;
}

export interface BoardDrop {
  columns: TasksByColumn;
  move: BoardMoveInput;
}

/**
 * The board after dropping `taskId` on `overId` — a task or, when `overIsColumn`,
 * the end of that column — and the neighbours to send.
 */
export function dropTask(
  groups: TasksByColumn,
  taskId: number,
  overId: number,
  overIsColumn: boolean,
): BoardDrop | null {
  const fromId = findColumnOf(groups, taskId);
  const toId = overIsColumn ? overId : findColumnOf(groups, overId);
  if (fromId === undefined || toId === undefined) return null;

  const source = groups.get(fromId) ?? [];
  const from = source.findIndex((task) => task.id === taskId);
  const moved = source[from];
  if (!moved) return null;

  const target = groups.get(toId) ?? [];
  const over = overIsColumn ? -1 : target.findIndex((t) => t.id === overId);
  if (
    fromId === toId &&
    (overIsColumn ? from === target.length - 1 : from === over)
  )
    return null;

  const next =
    fromId === toId
      ? arrayMove(target, from, overIsColumn ? target.length - 1 : over)
      : insertAt(target, moved, overIsColumn ? target.length : over);
  const index = next.findIndex((task) => task.id === taskId);

  const columns = new Map(groups);
  if (fromId !== toId) {
    columns.set(
      fromId,
      source.filter((task) => task.id !== taskId),
    );
  }
  columns.set(toId, next);
  return {
    columns,
    move: {
      columnId: toId,
      afterId: next[index - 1]?.id ?? null,
      beforeId: next[index + 1]?.id ?? null,
    },
  };
}

function findColumnOf(groups: TasksByColumn, taskId: number) {
  for (const [columnId, tasks] of groups) {
    if (tasks.some((task) => task.id === taskId)) return columnId;
  }
  return undefined;
}

function insertAt(tasks: Task[], task: Task, index: number): Task[] {
  return [...tasks.slice(0, index), task, ...tasks.slice(index)];
}

/** What a drop does to a task locally, before the server answers. */
export function applyOnDrop(
  task: Task,
  columnId: number,
  onDrop: OnDrop,
): Task | null {
  if (onDrop === "delete") return null;
  const moved = { ...task, columnId };
  if (onDrop === "complete") return { ...moved, isCompleted: true };
  if (onDrop === "uncomplete") return { ...moved, isCompleted: false };
  return moved;
}
