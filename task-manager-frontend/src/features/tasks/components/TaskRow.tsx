import {
  AlertCircle,
  Clock,
  Pencil,
  Play,
  Repeat,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { PopupModes, useTaskContext } from "../../../context/TaskContext";
import LabelChips from "../../labels/LabelChips";
import ProjectLabel from "../../projects/ProjectLabel";
import { priorityRingClasses } from "../constants";
import useSetIsCompleted from "../hooks/useSetIsCompleted";
import useSnoozeTask from "../hooks/useSnoozeTask";
import { describeRecurrence } from "../recurrence";
import type { SnoozePreset, Task } from "../types";
import {
  formatDateRange,
  formatMinutes,
  isTaskOverdue,
  playSound,
  taskMinutes,
} from "../utils";
import PriorityBadge from "./PriorityBadge";
import { SelectBox } from "./SelectBox";
import SnoozeMenu from "./SnoozeMenu";
import SubtaskCount from "./SubtaskCount";

interface TaskRowProps {
  task: Task;
  setIsCompleted: (id: number, isComplete: boolean, task?: Task) => void;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onOpen: (task: Task) => void;
  snoozeTask: (task: Task, preset: SnoozePreset, day?: string) => void;
}

const actionClass =
  "cursor-pointer rounded-md p-1.5 transition-colors hover:bg-surface-muted";

// Always laid out so revealing it never resizes the row: on hover or keyboard
// focus it fades in over the row's right edge. Touch screens cannot hover, so
// there it stays in the flow and visible.
const actionsClass = [
  "pointer-events-none absolute right-2 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5",
  "rounded-lg border bg-surface px-1 opacity-0 shadow-sm transition-opacity",
  "group-hover:pointer-events-auto group-hover:opacity-100",
  "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
  "[@media(pointer:coarse)]:pointer-events-auto [@media(pointer:coarse)]:static",
  "[@media(pointer:coarse)]:translate-y-0 [@media(pointer:coarse)]:opacity-100",
].join(" ");

export function TaskRow({
  task,
  setIsCompleted,
  onDelete,
  onEdit,
  onOpen,
  snoozeTask,
}: TaskRowProps) {
  const navigate = useNavigate();
  const { id, seriesId, isGhost, title, isCompleted, description } = task;
  const taskId = isGhost ? seriesId : id;
  const isOverdue = isTaskOverdue(task);
  const minutes = taskMinutes(task);
  const recurrence = task.isRepeating ? describeRecurrence(task) : "";

  const complete = () => {
    setIsCompleted(taskId, !isCompleted, task);
    if (!isCompleted) playSound("/success.mp3");
  };

  return (
    <article
      className={`group relative flex min-h-14 items-start gap-3 rounded-md border-b border-surface-muted px-2 py-2.5 transition-colors hover:bg-surface-muted/60 focus-within:bg-surface-muted/60 ${isCompleted ? "opacity-60" : ""}`}
    >
      <SelectBox task={task} />
      <button
        type="button"
        onClick={complete}
        title={isCompleted ? "Mark as pending" : "Mark as complete"}
        aria-label={
          isCompleted ? "Mark task as pending" : "Mark task as completed"
        }
        className={`mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-md border-2 transition-colors ${isCompleted ? "border-success bg-success" : priorityRingClasses[task.priority]}`}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h3
          className={`flex min-w-0 items-center gap-2 text-sm font-medium ${isCompleted ? "line-through" : ""}`}
        >
          <PriorityBadge priority={task.priority} />
          <button
            type="button"
            aria-label={`Open task: ${title}`}
            onClick={() => onOpen(task)}
            className="min-w-0 shrink cursor-pointer truncate text-left hover:underline"
          >
            {title}
          </button>
          {description && (
            <span className="hidden min-w-0 truncate text-xs font-normal text-text-sub md:inline">
              — {description}
            </span>
          )}
          <SubtaskCount
            done={task.subtaskCompletedCount}
            total={task.subtaskCount}
          />
        </h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-sub">
          <ProjectLabel
            projectId={task.projectId}
            className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-text-main"
          />
          <LabelChips labelIds={task.labelIds} />
          {recurrence && (
            <span className="inline-flex items-center gap-1">
              <Repeat aria-hidden size={11} />
              {recurrence}
            </span>
          )}
          {minutes > 0 && (
            <span className="inline-flex items-center gap-1">
              <Clock aria-hidden size={11} />
              {formatMinutes(minutes)}
            </span>
          )}
          <time
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 font-medium ${isOverdue ? "bg-failure/10 text-failure" : "text-text-main"}`}
          >
            {isOverdue && <AlertCircle aria-hidden size={12} />}
            {formatDateRange(task.startAt, task.endAt)}
          </time>
        </div>
      </div>

      <div className={actionsClass}>
        {!isCompleted && (
          <button
            type="button"
            onClick={() => navigate(`/pomodoro/${taskId}`)}
            title="Start Task"
            aria-label={`Start task: ${title}`}
            className="flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-brand hover:bg-brand/10"
          >
            <Play aria-hidden size={13} />
            Start
          </button>
        )}
        {!isCompleted && (
          <SnoozeMenu
            task={task}
            onSnooze={(preset, day) => snoozeTask(task, preset, day)}
          />
        )}
        {!isCompleted && (
          <button
            type="button"
            onClick={() => navigate(`/breakdown/${taskId}`)}
            title="Break down Task"
            aria-label={`Break down task: ${title}`}
            className={`${actionClass} text-brand`}
          >
            <Sparkles aria-hidden size={16} />
          </button>
        )}
        <button
          type="button"
          onClick={() => onEdit(isGhost ? { ...task, id: seriesId } : task)}
          title="Edit Task"
          aria-label={`Edit task: ${title}`}
          className={`${actionClass} text-text-sub`}
        >
          <Pencil aria-hidden size={16} />
        </button>
        <button
          type="button"
          onClick={() => onDelete(isGhost ? { ...task, id: seriesId } : task)}
          title="Delete Task"
          aria-label={`Delete task: ${title}`}
          className={`${actionClass} text-failure`}
        >
          <Trash2 aria-hidden size={16} />
        </button>
      </div>
    </article>
  );
}

export default function TaskRowConnected({ task }: { task: Task }) {
  const { openPopup, closePopup } = useTaskContext();
  const setIsCompleted = useSetIsCompleted();
  const { mutate: snooze } = useSnoozeTask({ onSnooze: closePopup });

  return (
    <TaskRow
      task={task}
      setIsCompleted={setIsCompleted}
      onDelete={(target) => openPopup(target, PopupModes.Delete)}
      onEdit={(target) => openPopup(target, PopupModes.Edit)}
      onOpen={(target) => openPopup(target, PopupModes.View)}
      snoozeTask={(target, preset, day) =>
        snooze({ task: target, preset, day })
      }
    />
  );
}
