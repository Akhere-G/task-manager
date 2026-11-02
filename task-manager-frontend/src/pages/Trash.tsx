import { RotateCcw } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
} from "../components/ui";
import useRestoreTask from "../features/tasks/hooks/useRestoreTask";
import useTrash from "../features/tasks/hooks/useTrash";
import { daysUntilPurge, formatDateRelative } from "../features/tasks/utils";
import type { TrashedTask } from "../features/tasks/types";

function daysLeftLabel(task: TrashedTask) {
  const days = daysUntilPurge(task.purgeAt);
  if (days === 0) return "Removed soon";
  return `${days} ${days === 1 ? "day" : "days"} left`;
}

export default function Trash() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  const { data, isLoading, isError } = useTrash(page);
  const restore = useRestoreTask();

  const tasks = data?.tasks ?? [];

  let content = <EmptyState searchMessage="Trash is empty." />;
  if (isError) {
    content = <ErrorState error="Could not get deleted tasks" />;
  } else if (isLoading) {
    content = <LoadingState loadMessage="Getting deleted tasks..." />;
  } else if (tasks.length > 0) {
    content = (
      <ul className="flex flex-col gap-2">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="card flex items-center justify-between gap-3"
          >
            <div className="flex flex-col min-w-0">
              <span className="font-semibold truncate text-text-main">
                {task.title}
              </span>
              <span className="text-xs text-text-sub">
                Deleted {formatDateRelative(task.deletedAt)} ·{" "}
                {daysLeftLabel(task)}
              </span>
            </div>
            <button
              className="btn-secondary flex items-center gap-1.5"
              aria-label={`Restore task ${task.title}`}
              disabled={restore.isPending}
              onClick={() => restore.mutate(task.id)}
            >
              <RotateCcw size={14} aria-hidden /> Restore
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section className="flex flex-col gap-3 min-h-full">
      <header className="card">
        <h1 className="text-3xl font-bold text-text-main">
          Trash ({data?.totalTasks ?? 0})
        </h1>
        <p className="text-text-sub">
          Deleted tasks can be restored for 30 days.
        </p>
      </header>
      {restore.isError && <ErrorState error="Could not restore the task" />}
      {content}
      <Pagination
        currentPage={page}
        totalItems={data?.totalTasks ?? 0}
        totalPages={data?.totalPages ?? 0}
        setPage={(next) => setSearchParams({ page: String(next) })}
        scrollUpOnNavigate
      />
    </section>
  );
}
