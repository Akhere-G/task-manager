import { format } from "date-fns";
import type { Task } from "../types";
import CalendarTaskList from "./TaskCalendarList";
import useSetIsCompleted from "../hooks/useSetIsCompleted";

interface MobileTaskSectionProps {
  currentDate: Date;
  tasks: Task[];
  onSelectTask: (task: Task) => void;
  setDraggedEvent: (task: Task | null) => void;
}

export default function MobileTaskSection({
  currentDate,
  tasks,
  onSelectTask,
  setDraggedEvent,
}: MobileTaskSectionProps) {
  const setIsCompleted = useSetIsCompleted();

  return (
    <div className="md:hidden space-y-4">
      <div className="flex items-center justify-between border-b border-border-light pb-2 px-1">
        <p className="text-sm font-bold text-text-sub uppercase tracking-widest">
          {format(currentDate, "E do MMMM")}
        </p>
        <span className="text-xs font-medium text-brand bg-brand/10 px-2 py-0.5 rounded-full">
          {tasks.length} Tasks
        </span>
      </div>

      <div className="grid gap-2">
        <CalendarTaskList
          tasks={tasks}
          currentDate={currentDate}
          setSelectedTask={onSelectTask}
          setIsCompleted={setIsCompleted}
          setDraggedEvent={setDraggedEvent}
        />
      </div>
    </div>
  );
}
