import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Settings } from "lucide-react";
import { useState } from "react";

import TotalsChip from "../../../components/ui/TotalsChip";
import { useCategoryTasks } from "../../tasks/hooks/useCategoryTasks";
import type { Task } from "../../tasks/types";
import { columnCategoryParams } from "../boardCache";
import type { BoardQuery, ProjectColumn } from "../types";
import ColumnCards from "./ColumnCards";
import ColumnSettings from "./ColumnSettings";
import QuickAddCard from "./QuickAddCard";

export const columnDragId = (id: number) => `column-${id}`;

interface KanbanColumnProps extends BoardQuery {
  column: ProjectColumn;
  /** The board as just dropped, shown until the server's answer is loaded. */
  droppedTasks?: Task[];
  onDelete: () => void;
}

export default function KanbanColumn({
  column,
  filters,
  search,
  view,
  droppedTasks,
  onDelete,
}: KanbanColumnProps) {
  const [showSettings, setShowSettings] = useState(false);
  const feed = useCategoryTasks({
    filters,
    search,
    view,
    params: columnCategoryParams(column.projectId, column.id),
  });
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
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        borderTopColor: column.colour,
      }}
      className={`flex max-h-[75vh] w-72 shrink-0 flex-col gap-2 rounded-xl border border-t-[3px] bg-surface-muted/50 pt-3 ${isDragging ? "opacity-50" : ""}`}
    >
      <header className="flex items-center gap-2 px-3">
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
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: column.colour }}
        />
        <h2 className="flex-1 truncate text-sm font-semibold text-text-main">
          {column.name}
        </h2>
        <TotalsChip total={feed.total} totalMinutes={feed.totalMinutes} />
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
      {showSettings && (
        <div className="px-3">
          <ColumnSettings column={column} onDelete={onDelete} />
        </div>
      )}
      <ColumnCards {...feed} tasks={droppedTasks ?? feed.tasks} />
      <div className="px-2 pb-2">
        <QuickAddCard
          projectId={column.projectId}
          columnId={column.id}
          columnName={column.name}
        />
      </div>
    </section>
  );
}
