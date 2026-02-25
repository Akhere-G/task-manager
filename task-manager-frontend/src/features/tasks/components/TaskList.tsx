import type { Task } from "../types";
import TaskCard from "./TaskCard";

interface TaskListProps {
  tasks: Task[];
}

export default function TaskList({ tasks }: TaskListProps) {
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="transition-all duration-500 animate-in fade-in slide-in-from-bottom-2"
        >
          <TaskCard {...task} />
        </li>
      ))}
    </ul>
  );
}
