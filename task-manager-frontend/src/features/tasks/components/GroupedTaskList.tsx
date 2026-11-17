import { TASK_GROUPS } from "../taskGroups";
import type { CategoryQuery } from "../taskParams";
import TaskGroup from "./TaskGroup";

interface GroupedTaskListProps {
  query: CategoryQuery;
  /** Rows can be dragged into a new order inside their group. */
  sortable: boolean;
}

export default function GroupedTaskList({
  query,
  sortable,
}: GroupedTaskListProps) {
  return (
    <div>
      {TASK_GROUPS.map((definition) => (
        <TaskGroup
          key={definition.id}
          definition={definition}
          query={query}
          sortable={sortable}
        />
      ))}
    </div>
  );
}
