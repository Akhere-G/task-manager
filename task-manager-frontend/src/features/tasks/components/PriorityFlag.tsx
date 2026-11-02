import { Flag } from "lucide-react";
import { priorityColours } from "../constants";

interface PriorityFlagProps {
  priority?: number;
  size?: number;
}

export default function PriorityFlag({
  priority,
  size = 14,
}: PriorityFlagProps) {
  const colour = priority ? priorityColours[priority] : undefined;
  if (!colour) return null;
  return (
    <Flag
      size={size}
      className={`shrink-0 fill-current ${colour}`}
      role="img"
      aria-label={`Priority ${priority}`}
    >
      <title>{`Priority ${priority}`}</title>
    </Flag>
  );
}
