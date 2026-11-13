import { useDroppable } from "@dnd-kit/core";
import { CountChip } from "../../../components/ui";
import type { Task } from "../../tasks/types";
import ColumnCards from "./ColumnCards";
import QuickAddCard from "./QuickAddCard";

export const UNASSIGNED_DRAG_ID = "column-unassigned";

interface UnassignedColumnProps {
  projectId: number;
  tasks: Task[];
}

export default function UnassignedColumn({
  projectId,
  tasks,
}: UnassignedColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: UNASSIGNED_DRAG_ID,
    data: { type: "unassigned" },
  });

  return (
    <section
      ref={setNodeRef}
      aria-label="Unassigned"
      className={`flex max-h-[75vh] w-72 shrink-0 flex-col gap-2 rounded-xl bg-surface p-3 ${isOver ? "ring-2 ring-brand/40" : ""}`}
    >
      <header className="flex items-center gap-2">
        <span
          aria-hidden
          className="h-3 w-3 shrink-0 rounded-full border border-slate-400"
        />
        <h2 className="flex-1 truncate font-semibold text-text-main">
          Unassigned <CountChip count={tasks.length} />
        </h2>
      </header>
      <ColumnCards tasks={tasks} />
      <QuickAddCard
        projectId={projectId}
        columnId={null}
        columnName="Unassigned"
      />
    </section>
  );
}
