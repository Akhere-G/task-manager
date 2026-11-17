import { arrayMove } from "@dnd-kit/sortable";
import type { MoveInput } from "./api";

export interface Reorder<T> {
  items: T[];
  move: MoveInput;
}

/** The list after dragging `activeId` onto `overId`, and the neighbours to send. */
export function reorder<T extends { id: number }>(
  items: T[],
  activeId: number,
  overId: number,
): Reorder<T> | null {
  const from = items.findIndex((item) => item.id === activeId);
  const to = items.findIndex((item) => item.id === overId);
  if (from < 0 || to < 0 || from === to) return null;

  const next = arrayMove(items, from, to);
  return {
    items: next,
    move: {
      afterId: next[to - 1]?.id ?? null,
      beforeId: next[to + 1]?.id ?? null,
    },
  };
}
