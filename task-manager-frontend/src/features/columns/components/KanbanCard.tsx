import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import useSavingTaskIds from "../../tasks/optimistic/useSavingTaskIds";
import type { Task } from "../../tasks/types";
import BoardTaskCard from "./BoardTaskCard";

export const taskDragId = (id: number) => `task-${id}`;

export default function KanbanCard({ task }: { task: Task }) {
  const isSaving = useSavingTaskIds().has(task.id);
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: taskDragId(task.id),
    data: { type: "task", taskId: task.id },
    disabled: { draggable: isSaving },
    animateLayoutChanges: () => false,
  });

  return (
    <li
      ref={(node) => {
        setNodeRef(node);
        setActivatorNodeRef(node);
      }}
      className={`touch-manipulation ${isDragging ? "opacity-40" : ""}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
    >
      <BoardTaskCard task={task} />
    </li>
  );
}
