import { useState } from "react";

import CategoryFooter from "../../../components/ui/CategoryFooter";
import ScrollFeed from "../../../components/ui/ScrollFeed";
import { useCategoryTasks } from "../hooks/useCategoryTasks";
import type { TaskGroupDefinition } from "../taskGroups";
import type { CategoryQuery } from "../taskParams";
import GroupActionsMenu from "./GroupActionsMenu";
import TaskGroupHeader from "./TaskGroupHeader";
import TaskList from "./TaskList";

interface TaskGroupProps {
  definition: TaskGroupDefinition;
  /** The list's filters, search and view, shared by every group. */
  query: CategoryQuery;
  sortable: boolean;
}

export default function TaskGroup({
  definition,
  query,
  sortable,
}: TaskGroupProps) {
  const [isOpen, setIsOpen] = useState(true);
  const groupQuery: CategoryQuery = {
    ...query,
    overrides: { ...query.overrides, ...definition.sortOverrides },
    params: { group: definition.id },
  };
  const feed = useCategoryTasks(groupQuery);

  // Nothing to show while loading or when empty, so a group never flashes as "0".
  if (feed.total === 0) return null;

  return (
    <section aria-label={definition.title}>
      <TaskGroupHeader
        title={definition.title}
        count={feed.total}
        totalMinutes={feed.totalMinutes}
        hint={definition.hint}
        isUrgent={definition.isUrgent}
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
        actions={
          <GroupActionsMenu
            name={definition.title}
            count={feed.total}
            query={groupQuery}
            canComplete={definition.id !== "completed"}
          />
        }
      />
      {isOpen && (
        <>
          <ScrollFeed
            isLoading={feed.isLoading}
            isEmpty={feed.tasks.length === 0}
            hasNextPage={feed.hasNextPage}
            isFetchingNextPage={feed.isFetchingNextPage}
            fetchNextPage={feed.fetchNextPage}
            emptyMessage={null}
            className="max-h-[28rem]"
          >
            <TaskList tasks={feed.tasks} sortable={sortable} />
          </ScrollFeed>
          <CategoryFooter
            shown={feed.tasks.length}
            total={feed.total}
            label={`in ${definition.title}`}
            className="px-2 pt-1"
          />
        </>
      )}
    </section>
  );
}
