import { CalendarDays, LayoutGrid, List } from "lucide-react";
import type { TaskLayout } from "../views";

interface LayoutToggleProps {
  layout: TaskLayout;
  onSelect: (layout: TaskLayout) => void;
}

const OPTIONS = [
  { value: "list", label: "List", Icon: List },
  { value: "calendar", label: "Calendar", Icon: CalendarDays },
  { value: "matrix", label: "Matrix", Icon: LayoutGrid },
] as const;

export default function LayoutToggle({ layout, onSelect }: LayoutToggleProps) {
  return (
    <div
      role="group"
      aria-label="Layout"
      className="flex flex-wrap gap-2 self-end"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={layout === value}
          onClick={() => onSelect(value)}
          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm ${layout === value ? "bg-brand text-white" : "bg-surface text-text-main hover:bg-brand/20"}`}
        >
          <Icon size={16} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
