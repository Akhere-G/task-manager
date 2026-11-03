import { ListChecks } from "lucide-react";

interface SubtaskCountProps {
  done: number;
  total: number;
}

export default function SubtaskCount({ done, total }: SubtaskCountProps) {
  if (total === 0) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-text-sub"
      title={`${done} of ${total} subtasks done`}
    >
      <ListChecks aria-hidden size={12} />
      {done}/{total}
    </span>
  );
}
