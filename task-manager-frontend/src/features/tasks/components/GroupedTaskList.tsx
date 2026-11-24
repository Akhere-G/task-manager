import useBulkResult from "../hooks/useBulkResult";
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
  const { banner, onResult } = useBulkResult();

  return (
    <div>
      {banner}
      {TASK_GROUPS.map((definition) => (
        <TaskGroup
          key={definition.id}
          definition={definition}
          query={query}
          sortable={sortable}
          onResult={onResult}
        />
      ))}
    </div>
  );
}
