import { arrayMove } from "@dnd-kit/sortable";
import type { Task } from "../tasks/types";
import type { BoardMoveInput, OnDrop, ProjectColumn } from "./types";

/** A column's id; `null` is the Unassigned column. */
export type ColumnKey = number | null;
export type TasksByColumn = Map<ColumnKey, Task[]>;

export type DropTarget =
  { type: "task"; taskId: number } | { type: "column"; columnId: ColumnKey };

/** Tasks of a board by column, Unassigned first; one with an unknown column is unassigned. */
export function groupByColumn(
  tasks: Task[],
  columns: ProjectColumn[],
): TasksByColumn {
  const groups: TasksByColumn = new Map<ColumnKey, Task[]>([
    [null, []],
    ...columns.map((column): [ColumnKey, Task[]] => [column.id, []]),
  ]);
  tasks.forEach((task) => {
    const key = groups.has(task.columnId) ? task.columnId : null;
    groups.get(key)?.push(task);
  });
  return groups;
}

export interface BoardDrop {
  columns: TasksByColumn;
  move: BoardMoveInput;
}

/** The board after dropping `taskId` on `target`, and the neighbours to send. */
export function dropTask(
  groups: TasksByColumn,
  taskId: number,
  target: DropTarget,
): BoardDrop | null {
  const fromKey = findColumnOf(groups, taskId);
  const toKey =
    target.type === "column"
      ? target.columnId
      : findColumnOf(groups, target.taskId);
  if (fromKey === undefined || toKey === undefined) return null;

  const source = groups.get(fromKey) ?? [];
  const from = source.findIndex((task) => task.id === taskId);
  const moved = source[from];
  if (!moved) return null;

  const destination = groups.get(toKey) ?? [];
  const over =
    target.type === "column"
      ? destination.length
      : destination.findIndex((task) => task.id === target.taskId);
  const sameColumn = fromKey === toKey;
  if (
    sameColumn &&
    (target.type === "task" ? from === over : from === over - 1)
  )
    return null;

  const next = sameColumn
    ? arrayMove(destination, from, target.type === "column" ? over - 1 : over)
    : [...destination.slice(0, over), moved, ...destination.slice(over)];
  const index = next.findIndex((task) => task.id === taskId);

  const columns = new Map(groups);
  if (!sameColumn) {
    columns.set(
      fromKey,
      source.filter((task) => task.id !== taskId),
    );
  }
  columns.set(toKey, next);
  return {
    columns,
    move: {
      columnId: toKey,
      afterId: next[index - 1]?.id ?? null,
      beforeId: next[index + 1]?.id ?? null,
    },
  };
}

function findColumnOf(groups: TasksByColumn, taskId: number) {
  for (const [key, tasks] of groups) {
    if (tasks.some((task) => task.id === taskId)) return key;
  }
  return undefined;
}

/** What a drop does to a task locally, before the server answers. */
export function applyOnDrop(
  task: Task,
  column: Pick<ProjectColumn, "id" | "onDrop"> | null,
): Task | null {
  if (column === null) return { ...task, columnId: null };
  const onDrop: OnDrop = column.onDrop;
  if (onDrop === "delete") return null;
  const moved = { ...task, columnId: column.id };
  if (onDrop === "complete") return { ...moved, isCompleted: true };
  if (onDrop === "uncomplete") return { ...moved, isCompleted: false };
  return moved;
}
