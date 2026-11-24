import { MoreHorizontal } from "lucide-react";
import DropdownMenu from "../../../components/ui/DropdownMenu";
import type { BulkResult } from "../api";
import useBulkTaskActions from "../hooks/useBulkTaskActions";
import { buildCategoryFilter, type CategoryQuery } from "../taskParams";
import GroupActionItems, {
  type ColumnChoice,
  type GroupActions,
  type PriorityChoice,
} from "./GroupActionItems";

interface GroupActionsMenuProps {
  name: string;
  /** How many tasks the group holds, shown in the menu's labels. */
  count: number;
  /** The group's own query, so actions reach tasks that are not loaded yet. */
  query: CategoryQuery;
  onResult: (result: BulkResult) => void;
  canComplete?: boolean;
  priorityChoices?: PriorityChoice[];
  columnChoices?: ColumnChoice[];
}

export default function GroupActionsMenu({
  name,
  count,
  query,
  onResult,
  canComplete = true,
  priorityChoices = [],
  columnChoices = [],
}: GroupActionsMenuProps) {
  const bulk = useBulkTaskActions();
  const target = { filter: buildCategoryFilter(query) };
  const report = { onSuccess: onResult };

  const actions: GroupActions = {
    complete: () => bulk.complete.mutate(target, report),
    snooze: (preset, day) =>
      bulk.snooze.mutate({ target, preset, day }, report),
    remove: () => bulk.remove.mutate(target, report),
    setPriority: (priority) =>
      bulk.setPriority.mutate({ target, priority }, report),
    move: (columnId) => bulk.move.mutate({ target, columnId }, report),
  };

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu
        label={`Actions for ${name}`}
        triggerClassName="cursor-pointer rounded-md border bg-surface p-1 text-text-sub hover:bg-surface-muted"
        trigger={<MoreHorizontal aria-hidden size={14} />}
      >
        {(close) => (
          <GroupActionItems
            count={count}
            canComplete={canComplete}
            priorityChoices={priorityChoices}
            columnChoices={columnChoices}
            actions={actions}
            close={close}
          />
        )}
      </DropdownMenu>
    </div>
  );
}
