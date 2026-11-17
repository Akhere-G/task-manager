import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import useDeleteSubtask from "../hooks/useDeleteSubtask";
import useUpdateTask from "../hooks/useUpdateTask";
import type { Subtask } from "../types";

export function SubtaskItem({ subtask }: { subtask: Subtask }) {
  const [isOpen, setIsOpen] = useState(false);
  const descriptionId = useId();
  const { mutate: updateTask } = useUpdateTask();
  const { mutate: removeSubtask } = useDeleteSubtask();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: subtask.id, animateLayoutChanges: () => false });
  const ToggleIcon = isOpen ? ChevronUp : ChevronDown;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`flex flex-col gap-1 rounded-md bg-surface ${isDragging ? "relative z-10 shadow-lg" : ""}`}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Reorder subtask ${subtask.title}`}
          className="p-1 text-text-sub cursor-grab touch-none"
        >
          <GripVertical aria-hidden="true" className="w-4 h-4" />
        </button>
        <label className="flex items-center gap-2 grow text-text-main">
          <input
            type="checkbox"
            checked={subtask.isCompleted}
            onChange={(e) =>
              updateTask({
                id: subtask.id,
                newTaskData: { isCompleted: e.target.checked },
              })
            }
          />
          <span className={subtask.isCompleted ? "line-through" : ""}>
            {subtask.title}
          </span>
        </label>
        {subtask.description && (
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls={descriptionId}
            aria-label={`Show details for ${subtask.title}`}
            className="p-1 text-text-sub hover:text-text-main cursor-pointer"
            onClick={() => setIsOpen((open) => !open)}
          >
            <ToggleIcon aria-hidden="true" className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          aria-label={`Delete subtask ${subtask.title}`}
          className="p-1 text-text-sub hover:text-failure cursor-pointer"
          onClick={() => removeSubtask(subtask.id)}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
      {isOpen && (
        <p
          id={descriptionId}
          className="pl-9 text-sm text-text-sub whitespace-pre-line wrap-break-word"
        >
          {subtask.description}
        </p>
      )}
    </li>
  );
}
