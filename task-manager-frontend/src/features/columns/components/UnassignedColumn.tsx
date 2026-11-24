import { useDroppable } from "@dnd-kit/core";

import TotalsChip from "../../../components/ui/TotalsChip";
import type { CategoryQuery } from "../../tasks/taskParams";
import { useCategoryTasks } from "../../tasks/hooks/useCategoryTasks";
import type { Task } from "../../tasks/types";
import { columnCategoryParams } from "../boardCache";
import type { BoardQuery } from "../types";
import GroupActionsMenu from "../../tasks/components/GroupActionsMenu";
import useBulkResult from "../../tasks/hooks/useBulkResult";
import type { ColumnChoice } from "../../tasks/components/GroupActionItems";
import ColumnCards from "./ColumnCards";
import QuickAddCard from "./QuickAddCard";

export const UNASSIGNED_DRAG_ID = "column-unassigned";

interface UnassignedColumnProps extends BoardQuery {
  projectId: number;
  /** The board as just dropped, shown until the server's answer is loaded. */
  droppedTasks?: Task[];
  /** Where the unassigned tasks can be moved in bulk. */
  moveChoices: ColumnChoice[];
}

export default function UnassignedColumn({
  projectId,
  filters,
  search,
  view,
  droppedTasks,
  moveChoices,
}: UnassignedColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: UNASSIGNED_DRAG_ID,
    data: { type: "unassigned" },
  });
  const query: CategoryQuery = {
    filters,
    search,
    view,
    params: columnCategoryParams(projectId, null),
  };
  const feed = useCategoryTasks(query);
  const { banner, onResult } = useBulkResult();

  return (
    <section
      ref={setNodeRef}
      aria-label="Unassigned"
      className={`flex max-h-[75vh] w-72 shrink-0 flex-col gap-2 rounded-xl border border-t-[3px] border-t-slate-400 bg-surface-muted/50 pt-3 ${isOver ? "ring-2 ring-brand/40" : ""}`}
    >
      <header className="flex items-center gap-2 px-3">
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-400"
        />
        <h2 className="flex-1 truncate text-sm font-semibold text-text-main">
          Unassigned
        </h2>
        <TotalsChip total={feed.total} totalMinutes={feed.totalMinutes} />
        {banner}
        <GroupActionsMenu
          name="Unassigned"
          count={feed.total}
          query={query}
          onResult={onResult}
          columnChoices={moveChoices}
        />
      </header>
      <ColumnCards {...feed} tasks={droppedTasks ?? feed.tasks} />
      <div className="px-2 pb-2">
        <QuickAddCard
          projectId={projectId}
          columnId={null}
          columnName="Unassigned"
        />
      </div>
    </section>
  );
}
