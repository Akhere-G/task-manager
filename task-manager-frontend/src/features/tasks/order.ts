import { arrayMove } from "@dnd-kit/sortable";
import type { MoveInput } from "./api";
import type { Task } from "./types";

export interface Reorder {
  tasks: Task[];
  move: MoveInput;
}

/** The list after dragging `activeId` onto `overId`, and the neighbours to send. */
export function reorder(
  tasks: Task[],
  activeId: number,
  overId: number,
): Reorder | null {
  const from = tasks.findIndex((task) => task.id === activeId);
  const to = tasks.findIndex((task) => task.id === overId);
  if (from < 0 || to < 0 || from === to) return null;

  const next = arrayMove(tasks, from, to);
  return {
    tasks: next,
    move: {
      afterId: next[to - 1]?.id ?? null,
      beforeId: next[to + 1]?.id ?? null,
    },
  };
}
