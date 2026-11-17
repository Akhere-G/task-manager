import { Loader2, Plus } from "lucide-react";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";

import { InfiniteSentinel } from "../../../components/ui/InfiniteSentinel";
import { priorityBadgeSolidClasses, quadrantPanelClasses } from "../constants";
import { useCategoryTasks } from "../hooks/useCategoryTasks";
import type { TaskFilters } from "../taskParams";
import type { Priority, Task } from "../types";
import { formatTaskTotals } from "../utils";
import { isRangedView, type TaskView } from "../views";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const {
    tasks,
    total,
    totalMinutes,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isLoading,
  } = useCategoryTasks({
    filters,
    search,
    view,
    overrides: { priority: String(priority) },
    includeProjections: isRangedView(view),
    enabled: allowsPriority(filters.priority, priority),
  });
  const remaining = total - tasks.length;

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
          <span className="rounded-full border bg-surface px-2 py-0.5 text-[11px] font-medium text-text-sub">
            {formatTaskTotals(total, totalMinutes)}
          </span>
          <button
            type="button"
            aria-label={`Add a P${priority} task`}
            title={`Add a P${priority} task`}
            onClick={() => navigate("/addtask", { state: { priority } })}
            className="cursor-pointer rounded-md border bg-surface p-1 text-text-sub hover:bg-surface-muted"
          >
            <Plus aria-hidden size={14} />
          </button>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto bg-surface"
      >
        {tasks.map((task) => (
          <MatrixTaskRow
            key={task.id}
            task={task}
            onDragTask={setDraggedTask}
          />
        ))}
        {!isLoading && tasks.length === 0 && (
          <p className="m-3 rounded-lg border border-dashed p-4 text-center text-xs text-text-sub">
            Drop tasks here to assign P{priority} ({description})
          </p>
        )}
        {isLoading && (
          <p className="p-4 text-center text-xs text-text-sub">Loading…</p>
        )}
        <InfiniteSentinel
          onVisible={fetchNextPage}
          disabled={!hasNextPage || isFetchingNextPage}
          scrollRef={scrollRef}
        />
        {isFetchingNextPage && (
          <Loader2
            aria-label="Loading more tasks"
            className="mx-auto my-2 animate-spin text-text-sub"
            size={16}
          />
        )}
      </div>

      {tasks.length > 0 && (
        <footer className="flex justify-between gap-2 rounded-b-xl border-t bg-surface px-3 py-1.5 text-[11px] text-text-sub">
          <span>
            Showing {tasks.length} of {total} tasks in {title}
          </span>
          {remaining > 0 && <span>Scroll for {remaining} more ↓</span>}
        </footer>
      )}
    </section>
  );
}
