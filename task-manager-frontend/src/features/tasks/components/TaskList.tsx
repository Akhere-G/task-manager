import { useBreakpoint } from "../../../hooks/useBreakpoint";
import type { Task } from "../types";
import TaskCard from "./TaskCard";
import TaskCardSmallConnected from "./TaskCardSmall";

interface TaskListProps {
  tasks: Task[];
}

export default function TaskList({ tasks }: TaskListProps) {
  const breakpoint = useBreakpoint();
  const isMobile = ["xs", "sm"].includes(breakpoint);

  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="transition-all duration-150 animate-in fade-in slide-in-from-bottom-2"
        >
          {isMobile ? (
            <TaskCardSmallConnected {...task} />
          ) : (
            <TaskCard {...task} />
          )}
        </li>
      ))}
    </ul>
  );
}
