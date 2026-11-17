import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Loader2 } from "lucide-react";
import { useRef } from "react";

import { InfiniteSentinel } from "../../../components/ui/InfiniteSentinel";
import type { Task } from "../../tasks/types";
import KanbanCard, { taskDragId } from "./KanbanCard";

interface ColumnCardsProps {
  tasks: Task[];
  total: number;
  isLoading: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
}

export default function ColumnCards({
  tasks,
  total,
  isLoading,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: ColumnCardsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const remaining = total - tasks.length;

  return (
    <SortableContext
      items={tasks.map((task) => taskDragId(task.id))}
      strategy={verticalListSortingStrategy}
    >
      <div ref={scrollRef} className="min-h-12 flex-1 overflow-y-auto px-2">
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} />
          ))}
        </ul>
        {!isLoading && tasks.length === 0 && (
          <p className="rounded-lg border border-dashed p-3 text-center text-xs text-text-sub">
            No tasks
          </p>
        )}
        {isLoading && (
          <p className="p-3 text-center text-xs text-text-sub">Loading…</p>
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
        <p className="flex justify-between gap-2 px-3 text-[11px] text-text-sub">
          <span>
            Showing {tasks.length} of {total}
          </span>
          {remaining > 0 && <span>Scroll for {remaining} more ↓</span>}
        </p>
      )}
    </SortableContext>
  );
}
