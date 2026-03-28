import { format } from "date-fns";
import type { Task } from "../types";
import TaskCardSmall from "./TaskCardSmall";

interface CalendarTaskList {
  tasks: Task[];
  currentDate: Date;
  setSelectedTask: (task: Task) => void;
  setIsCompleted: (taskId: number, isComplete: boolean) => void;
  setDraggedEvent: (task: Task | null) => void;
}

export default function CalendarTaskList({
  tasks,
  currentDate,
  setDraggedEvent,
}: CalendarTaskList) {
  if (tasks.length === 0) {
    return (
      <div className="py-10 text-center border-2 border-dashed border-slate-100 md:rounded-md bg-surface">
        <p className="text-text-sub text-sm italic">
          No tasks on {format(currentDate, "PPPP")}.
        </p>
      </div>
    );
  }
  return (
    <>
      {tasks.map((task) => {
        return (
          <TaskCardSmall
            key={task.id}
            {...task}
            setDraggedEvent={setDraggedEvent}
          />
        );
      })}
    </>
  );
}
