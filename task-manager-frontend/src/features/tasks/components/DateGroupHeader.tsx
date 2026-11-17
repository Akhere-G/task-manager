import { ChevronDown, ChevronRight } from "lucide-react";

import CountChip from "../../../components/ui/CountChip";
import type { DateGroup } from "../dateGroups";
import { formatMinutes } from "../utils";

interface DateGroupHeaderProps {
  group: DateGroup;
  isOpen: boolean;
  onToggle: () => void;
}

const summary = ({ kind, totalMinutes }: DateGroup) => {
  if (kind === "overdue") return "Needs rescheduling or completion";
  if (totalMinutes === 0) return "";
  return `${formatMinutes(totalMinutes)} ${kind === "today" || kind === "tomorrow" ? "total scheduled" : "scheduled"}`;
};

export default function DateGroupHeader({
  group,
  isOpen,
  onToggle,
}: DateGroupHeaderProps) {
  const Chevron = isOpen ? ChevronDown : ChevronRight;
  return (
    <div className="flex items-center justify-between gap-3 border-b border-surface-muted pb-1.5 pt-4">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label={`${group.label}, ${group.tasks.length} tasks`}
        className={`flex cursor-pointer items-center gap-2 text-sm font-semibold ${group.kind === "overdue" ? "text-failure" : "text-text-main"}`}
      >
        <Chevron aria-hidden size={16} />
        {group.label}
        <CountChip count={group.tasks.length} />
      </button>
      <span className="text-xs text-text-sub">{summary(group)}</span>
    </div>
  );
}
