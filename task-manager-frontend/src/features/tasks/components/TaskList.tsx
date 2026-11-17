import type { Task } from "../types";
import SortableTaskList from "./SortableTaskList";
import TaskRow from "./TaskRow";

interface TaskListProps {
  tasks: Task[];
  /** Lets the user drag rows into a new order. */
  sortable?: boolean;
}

const rowClass =
  "transition-all duration-150 animate-in fade-in slide-in-from-bottom-2";

export default function TaskList({ tasks, sortable = false }: TaskListProps) {
  if (sortable) return <SortableTaskList tasks={tasks} />;

  return (
    <ul>
      {tasks.map((task) => (
        <li key={task.id} className={rowClass}>
          <TaskRow task={task} />
        </li>
      ))}
    </ul>
  );
}
