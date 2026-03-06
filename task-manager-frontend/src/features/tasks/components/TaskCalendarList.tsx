import { format } from "date-fns";
import type { Task } from "../types";
import { CheckCircle2, Circle } from "lucide-react";

interface CalendarTaskList {
  tasks: Task[];
  currentDate: Date;
  setSelectedTask: (task: Task) => void;
  setIsCompleted: (taskId: number, isComplete: boolean) => void;
}

export default function CalendarTaskList({
  tasks,
  currentDate,
  setSelectedTask,
  setIsCompleted,
}: CalendarTaskList) {
  if (tasks.length === 0) {
    return (
      <div className="py-10 text-center border-2 border-dashed border-slate-100 rounded-3xl bg-surface">
        <p className="text-text-sub text-sm italic">
          No tasks on {format(currentDate, "PPPP")}.
        </p>
      </div>
    );
  }
  return (
    <>
      {tasks.map((task) => {
        const isOverdue =
          !task.isCompleted && new Date(task.endAt) < new Date();

        return (
          <div
            key={task.id}
            className="flex items-center justify-between p-4 gap-2 bg-surface border border-border-light rounded-2xl shadow-sm active:bg-surface-muted transition-colors"
            onClick={() => setSelectedTask(task)}
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
      })}
    </>
  );
}
