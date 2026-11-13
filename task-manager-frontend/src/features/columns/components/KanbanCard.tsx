import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import TaskCardSmallConnected from "../../tasks/components/TaskCardSmall";
import type { Task } from "../../tasks/types";

export const taskDragId = (id: number) => `task-${id}`;

export default function KanbanCard({ task }: { task: Task }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: taskDragId(task.id),
    data: { type: "task", taskId: task.id },
    animateLayoutChanges: () => false,
  });

  return (
    <li
      ref={setNodeRef}
      className={`touch-manipulation ${isDragging ? "opacity-40" : ""}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <TaskCardSmallConnected {...task} />
    </li>
  );
}
