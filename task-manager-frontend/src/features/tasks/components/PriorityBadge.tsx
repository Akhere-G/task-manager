import { priorityBadgeClasses } from "../constants";
import type { Priority } from "../types";
import PriorityFlag from "./PriorityFlag";

interface PriorityBadgeProps {
  priority: Priority;
}

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${priorityBadgeClasses[priority]}`}
    >
      <PriorityFlag priority={priority} size={10} />P{priority}
    </span>
  );
}
