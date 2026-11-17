import { useEffect, useState } from "react";
import { Check, Trash2, X } from "lucide-react";

import useBulkTaskActions from "../hooks/useBulkTaskActions";
import { useTaskSelection } from "../selection/useTaskSelection";
import SnoozeMenu from "./SnoozeMenu";

const buttonClass =
  "flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50";

export function BulkActionBar() {
  const { ids, clear } = useTaskSelection();
  const { complete, remove, snooze } = useBulkTaskActions();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const count = ids.size;
  const isBusy = complete.isPending || remove.isPending || snooze.isPending;

  useEffect(() => {
    if (count === 0) return;
    const clearOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") clear();
    };
    document.addEventListener("keydown", clearOnEscape);
    return () => document.removeEventListener("keydown", clearOnEscape);
  }, [count, clear]);

  if (count === 0) return null;
  const target = { ids: [...ids] };

  return (
    <div
      role="toolbar"
      aria-label="Bulk task actions"
      className="fixed bottom-5 left-1/2 z-20 flex flex-col gap-2  -translate-x-1/2 card rounded-lg"
    >
      <div className="flex gap-2 items-center justify-between">
        <span className="px-2 text-sm font-semibold">{count} selected</span>
        <button
          type="button"
          aria-label="Clear selection"
          onClick={clear}
          className={buttonClass}
        >
          <X aria-hidden size={16} />
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-1 ">
        {confirmingDelete ? (
          <>
            <span className="text-sm">
              Delete {count} {count === 1 ? "task" : "tasks"}?
            </span>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => remove.mutate(target)}
              className={`${buttonClass} text-failure`}
            >
              Confirm delete
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className={buttonClass}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              disabled={isBusy}
              onClick={() => complete.mutate(target)}
              className={buttonClass}
            >
              <Check aria-hidden size={16} />
              Complete
            </button>
            <SnoozeMenu
              label="Snooze selected tasks"
              actionText="Snooze"
              onSnooze={(preset, day) => snooze.mutate({ target, preset, day })}
            />
            <button
              type="button"
              disabled={isBusy}
              onClick={() => setConfirmingDelete(true)}
              className={`${buttonClass} text-failure`}
            >
              <Trash2 aria-hidden size={16} />
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}
