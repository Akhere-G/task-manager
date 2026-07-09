import { CheckCircle2, Circle, Repeat } from "lucide-react";
import type { Task } from "../types";
import { PopupModes, useTaskContext } from "../../../context/TaskContext";
import { formatDateRange, playSound } from "../utils";
import useSetIsCompleted from "../hooks/useSetIsCompleted";

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
      className="card flex items-center gap-2 overflow-hidden"
      onClick={() => setSelectedTask(task)}
      draggable={Boolean(setDraggedEvent)}
      onDragStart={() => setDraggedEvent?.(task)}
      onDragEnd={() => setDraggedEvent?.(null)}
    >
      <button
        aria-label={`Complete task ${task.title}`}
        onClick={(e) => {
          setIsCompleted(
            task.isGhost ? task.seriesId : task.id,
            !task.isCompleted,
          );
          if (!task.isCompleted) {
            playSound("/success.mp3");
          }
          e.stopPropagation();
        }}
      >
        {task.isCompleted ? (
          <CheckCircle2 size={16} className="text-brand" />
        ) : (
          <Circle size={16} className="text-slate-300" />
        )}
      </button>
      <p className="flex justify-between flex-1 overflow-hidden">
        <span className="flex flex-col gap truncate">
          <span
            className={`flex items-center font-semibold truncate text-ellipsis whitespace-nowrap text-nowrap over text-[12px] pr-1 ${task.isCompleted ? "text-text-sub line-through opacity-60" : "text-text-main"}`}
          >
            {task.isRepeating && <Repeat className="w-3 h-3 mr-2" />}
            {task.title}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-accent text-nowrap">
            {task.category?.replace("-", " ")}
          </span>
        </span>

        <span
          className={`text-[12px] text-nowrap ${isOverdue ? "text-failure" : "text-text-sub"}`}
        >
          {formatDateRange(task.startAt, task.endAt)}
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
  const setIsCompleted = useSetIsCompleted();

  const { openPopup } = useTaskContext();
  return (
    <TaskCardSmall
      setIsCompleted={setIsCompleted}
      setSelectedTask={(task) => openPopup(task, PopupModes.View)}
      {...props}
    />
  );
}
