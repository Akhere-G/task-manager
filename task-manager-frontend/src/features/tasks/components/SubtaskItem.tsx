import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { useToast } from "../../../context/ToastContext";
import { getApiErrorMessage } from "../../../utils/errors";
import useDeleteSubtask from "../hooks/useDeleteSubtask";
import usePendingWrite from "../hooks/usePendingWrite";
import useUpdateTask from "../hooks/useUpdateTask";
import type { Subtask } from "../types";
import SavingSpinner from "./SavingSpinner";

export function SubtaskItem({ subtask }: { subtask: Subtask }) {
  const [isOpen, setIsOpen] = useState(false);
  const descriptionId = useId();
  const { mutate: updateTask } = useUpdateTask();
  const { showError } = useToast();
  const removeSubtask = useDeleteSubtask();
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
  const { shown, isSaving, isRemoved } = usePendingWrite(subtask.id, subtask);
  if (isRemoved) return null;

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
            checked={shown.isCompleted}
            disabled={isSaving}
            className="disabled:cursor-not-allowed disabled:opacity-50"
            onChange={(e) => {
              const change = { isCompleted: e.target.checked };
              updateTask(
                { id: subtask.id, newTaskData: change, preview: change },
                {
                  onError: (error) =>
                    showError(
                      getApiErrorMessage(error, "Could not update the subtask"),
                    ),
                },
              );
            }}
          />
          <span className={shown.isCompleted ? "line-through" : ""}>
            {subtask.title}
          </span>
        </label>
        {isSaving && <SavingSpinner className="text-text-sub" />}
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
          disabled={isSaving}
          className="p-1 text-text-sub hover:text-failure cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
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
