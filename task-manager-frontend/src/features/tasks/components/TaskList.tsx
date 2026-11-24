import type { QueryKey } from "@tanstack/react-query";
import type { Task } from "../types";
import SortableTaskList from "./SortableTaskList";
import TaskRow from "./TaskRow";

interface TaskListProps {
  tasks: Task[];
  /** Lets the user drag rows into a new order in the query that loaded them. */
  sortableQueryKey?: QueryKey;
}

const rowClass =
  "transition-all duration-150 animate-in fade-in slide-in-from-bottom-2";

export default function TaskList({ tasks, sortableQueryKey }: TaskListProps) {
  if (sortableQueryKey) {
    return <SortableTaskList tasks={tasks} queryKey={sortableQueryKey} />;
  }

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
