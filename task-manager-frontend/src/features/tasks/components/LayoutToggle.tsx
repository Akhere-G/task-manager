import {
  CalendarDays,
  Columns3,
  LayoutGrid,
  List,
  type LucideIcon,
} from "lucide-react";
import type { TaskLayout } from "../views";

interface LayoutToggleProps {
  layout: TaskLayout;
  /** The board shows one project, so it needs one selected. */
  hasProject: boolean;
  onSelect: (layout: TaskLayout) => void;
}

export default function LayoutToggle({
  layout,
  hasProject,
  onSelect,
}: LayoutToggleProps) {
  const OPTIONS: { value: TaskLayout; label: string; Icon: LucideIcon }[] = [
    { value: "list", label: "List", Icon: List },
    { value: "calendar", label: "Calendar", Icon: CalendarDays },
    { value: "matrix", label: "Matrix", Icon: LayoutGrid },
  ];

  if (hasProject) {
    OPTIONS.push({ value: "kanban", label: "Board", Icon: Columns3 });
  }
  return (
    <div
      role="group"
      aria-label="Layout"
      className="flex shrink-1 flex-0 gap-2 self-end"
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
