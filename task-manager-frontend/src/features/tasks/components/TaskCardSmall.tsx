import { CheckCircle2, Circle } from "lucide-react";
import type { Task } from "../types";
import { format } from "date-fns";
import { PopupModes, useTaskContext } from "../../../context/TaskContext";

interface TaskCardSmallProps extends Task {
  setSelectedTask: (task: Task) => void;
  setDraggedEvent?: (task: Task | null) => void;
  setIsCompleted: (id: number, isCompleted: boolean) => void;
}
export function TaskCardSmall({
  setSelectedTask,
  setDraggedEvent,
  setIsCompleted,
  ...task
}: TaskCardSmallProps) {
  const isOverdue = !task.isCompleted && new Date(task.endAt) < new Date();
  return (
    <div
      key={task.id}
      className="flex items-center justify-between p-4 gap-2 bg-surface border border-border-light rounded-2xl shadow-sm active:bg-surface-muted transition-colors"
      onClick={() => setSelectedTask(task)}
      draggable={Boolean(setDraggedEvent)}
      onDragStart={() => setDraggedEvent?.(task)}
      onDragEnd={() => setDraggedEvent?.(null)}
    >
      <button
        onClick={(e) => {
          setIsCompleted(task.id, !task.isCompleted);
          e.stopPropagation();
        }}
      >
        {task.isCompleted ? (
          <CheckCircle2 size={24} className="text-brand" />
        ) : (
          <Circle size={24} className="text-slate-300" />
        )}
      </button>
      <p className="flex justify-between flex-1 ">
        <span
          className={`font-semibold truncate text-sm text-wrap ${task.isCompleted ? "text-text-sub line-through opacity-60" : "text-text-main"}`}
        >
          {task.title}
        </span>
        <span
          className={`text-sm text-nowrap ${isOverdue ? "text-failure" : "text-text-sub"}`}
        >
          {format(new Date(task.startAt), "p")}
        </span>
      </p>
    </div>
  );
}

interface TaskCardSmallConnectedProps extends Task {
  setDraggedEvent?: (task: Task | null) => void;
}

export default function TaskCardSmallConnected(
  props: TaskCardSmallConnectedProps,
) {
  const { setIsCompleted, openPopup } = useTaskContext();
  return (
    <TaskCardSmall
      setIsCompleted={setIsCompleted}
      setSelectedTask={(task) => openPopup(task, PopupModes.View)}
      {...props}
    />
  );
}
