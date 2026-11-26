import { AlertCircle, GripVertical, Repeat } from "lucide-react";

import { PopupModes, useTaskContext } from "../../../context/TaskContext";
import ProjectLabel from "../../projects/ProjectLabel";
import { priorityRingClasses } from "../constants";
import { SelectBox } from "./SelectBox";
import useSetIsCompleted from "../hooks/useSetIsCompleted";
import useSavingTaskIds from "../optimistic/useSavingTaskIds";
import { describeRecurrence } from "../recurrence";
import type { Task } from "../types";
import {
  formatDateRange,
  formatMinutes,
  isTaskOverdue,
  taskMinutes,
  taskTargetId,
} from "../utils";

interface MatrixTaskRowProps {
  task: Task;
  onDragTask: (task: Task | null) => void;
  setIsCompleted: (id: number, isCompleted: boolean, task?: Task) => void;
  isSaving?: boolean;
  onOpen: (task: Task) => void;
}

export function MatrixTaskRow({
  task,
  onDragTask,
  setIsCompleted,
  isSaving = false,
  onOpen,
}: MatrixTaskRowProps) {
  const isOverdue = isTaskOverdue(task);
  const minutes = taskMinutes(task);

  const complete = () => {
    setIsCompleted(taskTargetId(task), !task.isCompleted, task);
  };

  return (
    <article
      draggable={!isSaving}
      onDragStart={() => onDragTask(task)}
      onDragEnd={() => onDragTask(null)}
      className={`group flex items-center gap-2 border-b border-surface-muted px-2 py-2 hover:bg-surface-muted/60 focus-within:bg-surface-muted/60 ${isSaving ? "" : "cursor-grab"} ${task.isCompleted ? "opacity-60" : ""}`}
    >
      <GripVertical
        aria-hidden
        size={14}
        className="shrink-0 text-text-sub/50 group-hover:text-text-sub"
      />
      <SelectBox task={task} />
      <button
        type="button"
        onClick={complete}
        disabled={isSaving}
        aria-label={
          task.isCompleted ? "Mark task as pending" : "Mark task as completed"
        }
        title={task.isCompleted ? "Mark as pending" : "Mark as complete"}
        className={`h-4.5 w-4.5 shrink-0 cursor-pointer rounded-md border-2 disabled:cursor-not-allowed disabled:opacity-50 ${task.isCompleted ? "border-success bg-success" : priorityRingClasses[task.priority]}`}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <button
          type="button"
          aria-label={`Open task: ${task.title}`}
          onClick={() => onOpen(task)}
          className={`flex cursor-pointer items-center gap-1.5 truncate text-left text-sm font-medium hover:underline ${task.isCompleted ? "line-through" : ""}`}
        >
          <span className="truncate">{task.title}</span>
          {task.isRepeating && (
            <Repeat aria-hidden size={12} className="shrink-0 text-text-sub">
              <title>{describeRecurrence(task)}</title>
            </Repeat>
          )}
        </button>
        <span className="flex min-w-0 items-center gap-1 text-[11px] text-text-sub">
          <ProjectLabel projectId={task.projectId} />
          {minutes > 0 && <span>· {formatMinutes(minutes)}</span>}
          {task.description && (
            <span className="truncate">· {task.description}</span>
          )}
        </span>
      </div>
      <time
        className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] ${isOverdue ? "bg-failure/10 font-medium text-failure" : "text-text-sub"}`}
      >
        {isOverdue && <AlertCircle aria-hidden size={11} />}
        {formatDateRange(task.startAt, task.endAt)}
      </time>
    </article>
  );
}

export default function MatrixTaskRowConnected(
  props: Pick<MatrixTaskRowProps, "task" | "onDragTask">,
) {
  const { openPopup } = useTaskContext();
  const { setIsCompleted } = useSetIsCompleted();
  const isSaving = useSavingTaskIds().has(taskTargetId(props.task));
  return (
    <MatrixTaskRow
      {...props}
      setIsCompleted={setIsCompleted}
      isSaving={isSaving}
      onOpen={(task) => openPopup(task, PopupModes.View)}
    />
  );
}
