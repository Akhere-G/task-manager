import { useState } from "react";

import { menuItemClass } from "../../../components/ui/menuStyles";
import type { Priority, SnoozePreset } from "../types";
import SnoozeOptions from "./SnoozeOptions";

export interface ColumnChoice {
  /** The column id, or null for the board's unassigned column. */
  id: number | null;
  name: string;
}

export interface PriorityChoice {
  priority: Priority;
  title: string;
}

export interface GroupActions {
  complete: () => void;
  snooze: (preset: SnoozePreset, day?: string) => void;
  remove: () => void;
  setPriority: (priority: Priority) => void;
  move: (columnId: number | null) => void;
}

interface GroupActionItemsProps {
  count: number;
  canComplete: boolean;
  priorityChoices: PriorityChoice[];
  columnChoices: ColumnChoice[];
  actions: GroupActions;
  close: () => void;
}

const sectionHeading =
  "px-3 pt-1 text-[11px] font-semibold uppercase tracking-wide text-text-sub";

const taskCount = (count: number) =>
  `${count} ${count === 1 ? "task" : "tasks"}`;

export default function GroupActionItems({
  count,
  canComplete,
  priorityChoices,
  columnChoices,
  actions,
  close,
}: GroupActionItemsProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const act = (run: () => void) => {
    close();
    run();
  };

  if (isConfirmingDelete) {
    return (
      <>
        <p className="px-3 py-1 text-sm">Delete {taskCount(count)}?</p>
        <button
          type="button"
          role="menuitem"
          className={`${menuItemClass} font-medium text-failure`}
          onClick={() => act(actions.remove)}
        >
          Confirm delete
        </button>
        <button
          type="button"
          role="menuitem"
          className={menuItemClass}
          onClick={() => setIsConfirmingDelete(false)}
        >
          Cancel
        </button>
      </>
    );
  }

  return (
    <>
      {canComplete && (
        <button
          type="button"
          role="menuitem"
          className={menuItemClass}
          onClick={() => act(actions.complete)}
        >
          Complete all {count}
        </button>
      )}

      <p className={sectionHeading}>Reschedule to</p>
      <SnoozeOptions
        hasNextOccurrence={false}
        onChoose={(preset, day) => act(() => actions.snooze(preset, day))}
      />

      {priorityChoices.length > 0 && (
        <>
          <p className={sectionHeading}>Change priority</p>
          {priorityChoices.map(({ priority, title }) => (
            <button
              key={priority}
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => act(() => actions.setPriority(priority))}
            >
              P{priority} · {title}
            </button>
          ))}
        </>
      )}

      {columnChoices.length > 0 && (
        <>
          <p className={sectionHeading}>Move to column</p>
          {columnChoices.map(({ id, name }) => (
            <button
              key={id ?? "unassigned"}
              type="button"
              role="menuitem"
              className={menuItemClass}
              onClick={() => act(() => actions.move(id))}
            >
              {name}
            </button>
          ))}
        </>
      )}

      <button
        type="button"
        role="menuitem"
        className={`${menuItemClass} text-failure`}
        onClick={() => setIsConfirmingDelete(true)}
      >
        Delete all {count}
      </button>
    </>
  );
}
