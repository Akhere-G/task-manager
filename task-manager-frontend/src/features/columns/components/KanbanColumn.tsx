import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Settings } from "lucide-react";
import { useState } from "react";
import type { Task } from "../../tasks/types";
import ColumnSettings from "./ColumnSettings";
import ColumnCards from "./ColumnCards";
import QuickAddCard from "./QuickAddCard";
import type { ProjectColumn } from "../types";

export const columnDragId = (id: number) => `column-${id}`;

interface KanbanColumnProps {
  column: ProjectColumn;
  tasks: Task[];
  onDelete: () => void;
}

export default function KanbanColumn({
  column,
  tasks,
  onDelete,
}: KanbanColumnProps) {
  const [showSettings, setShowSettings] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: columnDragId(column.id),
    data: { type: "column", columnId: column.id },
    animateLayoutChanges: () => false,
  });

  return (
    <section
      ref={setNodeRef}
      aria-label={column.name}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex max-h-[75vh] w-72 shrink-0 flex-col gap-2 rounded-xl bg-surface p-3 ${isDragging ? "opacity-50" : ""}`}
    >
      <header className="flex items-center gap-2">
        <button
          type="button"
          aria-label={`Drag column ${column.name}`}
          className="cursor-grab touch-none text-text-sub"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden />
        </button>
        <span
          aria-hidden
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: column.colour }}
        />
        <h2 className="flex-1 truncate font-semibold text-text-main">
          {column.name} ({tasks.length})
        </h2>
        <button
          type="button"
          aria-label={`Settings for ${column.name}`}
          aria-expanded={showSettings}
          onClick={() => setShowSettings((open) => !open)}
          className="text-text-sub hover:text-text-main"
        >
          <Settings size={16} aria-hidden />
        </button>
      </header>
      {showSettings && <ColumnSettings column={column} onDelete={onDelete} />}
      <ColumnCards tasks={tasks} />
      <QuickAddCard
        projectId={column.projectId}
        columnId={column.id}
        columnName={column.name}
      />
    </section>
  );
}
