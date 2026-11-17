import { Check } from "lucide-react";

import { useTaskSelection } from "../selection/useTaskSelection";
import type { Task } from "../types";

export function SelectBox({ task }: { task: Task }) {
  const { enabled, ids, toggle } = useTaskSelection();
  if (!enabled || task.isGhost) return null;

  const selected = ids.has(task.id);
  const reveal = ids.size > 0 ? "" : "opacity-0 group-hover:opacity-100";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={`Select task: ${task.title}`}
      draggable={false}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={() => toggle(task.id)}
      className={`flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded border transition-opacity focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100 ${reveal} ${selected ? "border-brand bg-brand text-white opacity-100" : "bg-surface"}`}
    >
      {selected && <Check aria-hidden size={11} strokeWidth={3} />}
    </button>
  );
}
