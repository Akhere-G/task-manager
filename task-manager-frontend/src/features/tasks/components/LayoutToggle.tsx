import { CalendarDays, Columns3, LayoutGrid, List } from "lucide-react";
import type { TaskLayout } from "../views";

interface LayoutToggleProps {
  layout: TaskLayout;
  /** The board shows one project, so it needs one selected. */
  hasProject: boolean;
  onSelect: (layout: TaskLayout) => void;
}

const OPTIONS = [
  { value: "list", label: "List", Icon: List },
  { value: "calendar", label: "Calendar", Icon: CalendarDays },
  { value: "matrix", label: "Matrix", Icon: LayoutGrid },
  { value: "kanban", label: "Board", Icon: Columns3 },
] as const;

export default function LayoutToggle({
  layout,
  hasProject,
  onSelect,
}: LayoutToggleProps) {
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
          disabled={value === "kanban" && !hasProject}
          title={
            value === "kanban" && !hasProject
              ? "Select a project to use its board"
              : undefined
          }
          onClick={() => onSelect(value)}
          className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm disabled:opacity-50 ${layout === value ? "bg-brand text-white" : "bg-surface text-text-main hover:bg-brand/20"}`}
        >
          <Icon size={16} aria-hidden />
          {label}
        </button>
      ))}
    </div>
  );
}
