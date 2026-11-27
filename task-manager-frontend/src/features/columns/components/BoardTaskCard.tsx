import { AlertCircle, Repeat } from "lucide-react";

import { PopupModes, useTaskContext } from "../../../context/TaskContext";
import LabelChips from "../../labels/LabelChips";
import ProjectLabel from "../../projects/ProjectLabel";
import PriorityBadge from "../../tasks/components/PriorityBadge";
import { SelectBox } from "../../tasks/components/SelectBox";
import SubtaskCount from "../../tasks/components/SubtaskCount";
import SavingSpinner from "../../tasks/components/SavingSpinner";
import { priorityRingClasses } from "../../tasks/constants";
import usePendingWrite from "../../tasks/hooks/usePendingWrite";
import useSetIsCompleted from "../../tasks/hooks/useSetIsCompleted";
import { describeRecurrence } from "../../tasks/recurrence";
import type { Task } from "../../tasks/types";
import {
  formatDateRange,
  formatMinutes,
  isTaskOverdue,
  taskMinutes,
  taskTargetId,
} from "../../tasks/utils";

interface BoardTaskCardProps {
  task: Task;
  setIsCompleted: (id: number, isCompleted: boolean, task?: Task) => void;
  isSaving?: boolean;
  onOpen: (task: Task) => void;
}

export function BoardTaskCard({
  task,
  setIsCompleted,
  isSaving = false,
  onOpen,
}: BoardTaskCardProps) {
  const isOverdue = isTaskOverdue(task);
  const minutes = taskMinutes(task);

  const complete = () => {
    setIsCompleted(taskTargetId(task), !task.isCompleted, task);
  };

  return (
    <article
      className={`flex flex-col gap-1.5 rounded-lg border bg-surface p-2.5 shadow-sm transition-shadow hover:shadow-md ${task.isCompleted ? "opacity-60" : ""}`}
    >
      <div className="flex items-start gap-2">
        <SelectBox task={task} />
        <button
          type="button"
          onClick={complete}
          disabled={isSaving}
          aria-label={`Complete task ${task.title}`}
          title={task.isCompleted ? "Mark as pending" : "Mark as complete"}
          className={`mt-0.5 h-4.5 w-4.5 shrink-0 cursor-pointer rounded-md border-2 disabled:cursor-not-allowed disabled:opacity-50 ${task.isCompleted ? "border-success bg-success" : priorityRingClasses[task.priority]}`}
        />
        <button
          type="button"
          aria-label={`Open task: ${task.title}`}
          onClick={() => onOpen(task)}
          className={`min-w-0 flex-1 cursor-pointer text-left text-sm font-medium hover:underline ${task.isCompleted ? "line-through" : ""}`}
        >
          {task.title}
        </button>
        {isSaving && <SavingSpinner className="text-text-sub" />}
        <PriorityBadge priority={task.priority} />
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pl-6.5 text-[11px] text-text-sub">
        <ProjectLabel projectId={task.projectId} />
        {minutes > 0 && <span>· {formatMinutes(minutes)}</span>}
        {task.isRepeating && (
          <Repeat aria-hidden size={12}>
            <title>{describeRecurrence(task)}</title>
          </Repeat>
        )}
        <SubtaskCount
          done={task.subtaskCompletedCount}
          total={task.subtaskCount}
        />
      </div>
      <LabelChips labelIds={task.labelIds} className="pl-6.5" />
      {task.startAt && (
        <time
          className={`ml-6.5 inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[11px] ${isOverdue ? "bg-failure/10 font-medium text-failure" : "bg-surface-muted text-text-sub"}`}
        >
          {isOverdue && <AlertCircle aria-hidden size={11} />}
          {formatDateRange(task.startAt, task.endAt)}
        </time>
      )}
    </article>
  );
}

export default function BoardTaskCardConnected({ task }: { task: Task }) {
  const { openPopup } = useTaskContext();
  const { setIsCompleted } = useSetIsCompleted();
  const { shown, isSaving, isRemoved } = usePendingWrite(
    taskTargetId(task),
    task,
  );
  if (isRemoved) return null;

  return (
    <BoardTaskCard
      task={shown}
      setIsCompleted={setIsCompleted}
      isSaving={isSaving}
      onOpen={() => openPopup(task, PopupModes.View)}
    />
  );
}
