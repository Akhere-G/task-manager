import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import CategoryFooter from "../../../components/ui/CategoryFooter";
import ScrollFeed from "../../../components/ui/ScrollFeed";
import TotalsChip from "../../../components/ui/TotalsChip";
import {
  matrixQuadrants,
  priorityBadgeSolidClasses,
  quadrantPanelClasses,
} from "../constants";
import { useCategoryTasks } from "../hooks/useCategoryTasks";
import type { CategoryQuery, TaskFilters } from "../taskParams";
import type { Priority, Task } from "../types";
import type { TaskView } from "../views";
import useBulkResult from "../hooks/useBulkResult";
import GroupActionsMenu from "./GroupActionsMenu";
import MatrixTaskRow from "./MatrixTaskRow";

interface MatrixQuadrantProps {
  priority: Priority;
  title: string;
  description: string;
  filters: TaskFilters;
  search: string;
  view: TaskView;
  setDraggedTask: (task: Task | null) => void;
  onDropTask: (priority: Priority) => void;
}

const allowsPriority = (filter: string, priority: Priority) =>
  filter === "" || filter.split(",").includes(String(priority));

export default function MatrixQuadrant({
  priority,
  title,
  description,
  filters,
  search,
  view,
  setDraggedTask,
  onDropTask,
}: MatrixQuadrantProps) {
  const navigate = useNavigate();
  const { banner, onResult } = useBulkResult();
  const query: CategoryQuery = {
    filters,
    search,
    view,
    overrides: { priority: String(priority) },
  };
  const {
    tasks,
    total,
    totalMinutes,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isLoading,
  } = useCategoryTasks({
    ...query,
    enabled: allowsPriority(filters.priority, priority),
  });
  const otherQuadrants = matrixQuadrants.filter(
    (quadrant) => quadrant.priority !== priority,
  );

  return (
    <section
      aria-label={title}
      className={`flex h-[26rem] min-w-0 flex-col rounded-xl border ${quadrantPanelClasses[priority]}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDropTask(priority)}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2.5">
        <h2 className="flex min-w-0 items-center gap-2 text-sm">
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${priorityBadgeSolidClasses[priority]}`}
          >
            P{priority}
          </span>
          <span className="font-semibold text-text-main">{title}</span>
          <span className="hidden truncate text-xs font-normal text-text-sub sm:inline">
            · {description}
          </span>
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <TotalsChip total={total} totalMinutes={totalMinutes} />
          <button
            type="button"
            aria-label={`Add a P${priority} task`}
            title={`Add a P${priority} task`}
            onClick={() => navigate("/addtask", { state: { priority } })}
            className="cursor-pointer rounded-md border bg-surface p-1 text-text-sub hover:bg-surface-muted"
          >
            <Plus aria-hidden size={14} />
          </button>
          {banner}
          <GroupActionsMenu
            name={title}
            count={total}
            query={query}
            onResult={onResult}
            priorityChoices={otherQuadrants}
          />
        </div>
      </header>

      <ScrollFeed
        isLoading={isLoading}
        isEmpty={tasks.length === 0}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        className="min-h-0 flex-1 bg-surface"
        emptyMessage={
          <p className="m-3 rounded-lg border border-dashed p-4 text-center text-xs text-text-sub">
            Drop tasks here to assign P{priority} ({description})
          </p>
        }
      >
        {tasks.map((task) => (
          <MatrixTaskRow
            key={task.id}
            task={task}
            onDragTask={setDraggedTask}
          />
        ))}
      </ScrollFeed>

      {tasks.length > 0 && (
        <CategoryFooter
          shown={tasks.length}
          total={total}
          label={`tasks in ${title}`}
          className="rounded-b-xl border-t bg-surface px-3 py-1.5"
        />
      )}
    </section>
  );
}
