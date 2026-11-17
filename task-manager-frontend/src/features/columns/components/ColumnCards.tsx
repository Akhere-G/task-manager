import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import CategoryFooter from "../../../components/ui/CategoryFooter";
import ScrollFeed from "../../../components/ui/ScrollFeed";
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
  return (
    <SortableContext
      items={tasks.map((task) => taskDragId(task.id))}
      strategy={verticalListSortingStrategy}
    >
      <ScrollFeed
        isLoading={isLoading}
        isEmpty={tasks.length === 0}
        hasNextPage={hasNextPage}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        className="min-h-12 flex-1 px-2"
        emptyMessage={
          <p className="rounded-lg border border-dashed p-3 text-center text-xs text-text-sub">
            No tasks
          </p>
        }
      >
        <ul className="flex flex-col gap-2">
          {tasks.map((task) => (
            <KanbanCard key={task.id} task={task} />
          ))}
        </ul>
      </ScrollFeed>
      {tasks.length > 0 && (
        <CategoryFooter shown={tasks.length} total={total} className="px-3" />
      )}
    </SortableContext>
  );
}
