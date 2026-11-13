import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Task } from "../../tasks/types";
import KanbanCard, { taskDragId } from "./KanbanCard";

export default function ColumnCards({ tasks }: { tasks: Task[] }) {
  return (
    <SortableContext
      items={tasks.map((task) => taskDragId(task.id))}
      strategy={verticalListSortingStrategy}
    >
      <ul className="flex min-h-12 flex-col gap-2 overflow-y-auto">
        {tasks.map((task) => (
          <KanbanCard key={task.id} task={task} />
        ))}
      </ul>
    </SortableContext>
  );
}
