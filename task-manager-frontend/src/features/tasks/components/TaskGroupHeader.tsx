import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import CountChip from "../../../components/ui/CountChip";
import { formatMinutes } from "../utils";

interface TaskGroupHeaderProps {
  title: string;
  count: number;
  totalMinutes: number;
  hint?: string;
  isUrgent?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  /** Controls shown at the right edge, such as the group's menu. */
  actions?: ReactNode;
}

const summaryOf = (hint: string | undefined, totalMinutes: number) => {
  if (hint) return hint;
  return totalMinutes > 0 ? `${formatMinutes(totalMinutes)} scheduled` : "";
};

export default function TaskGroupHeader({
  title,
  count,
  totalMinutes,
  hint,
  isUrgent = false,
  isOpen,
  onToggle,
  actions,
}: TaskGroupHeaderProps) {
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  const tone = isUrgent ? "text-failure" : "text-text-main";

  return (
    <div className="flex items-center justify-between gap-3 border-b border-surface-muted pb-1.5 pt-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={`${title}, ${count} tasks`}
        className={`flex cursor-pointer items-center gap-2 text-sm font-semibold ${tone}`}
      >
        <Chevron aria-hidden size={16} />
        {title}
        <CountChip count={count} />
      </button>
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-sub">
          {summaryOf(hint, totalMinutes)}
        </span>
        {actions}
      </div>
    </div>
  );
}
