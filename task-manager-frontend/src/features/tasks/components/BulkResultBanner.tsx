import { useEffect } from "react";
import { Check, TriangleAlert, X } from "lucide-react";

import type { BulkResult } from "../api";

const SUCCESS_DISMISS_MS = 4000;

const countTasks = (count: number) =>
  `${count} ${count === 1 ? "task" : "tasks"}`;

interface BulkResultBannerProps {
  result: BulkResult;
  onDismiss: () => void;
}

export function BulkResultBanner({ result, onDismiss }: BulkResultBannerProps) {
  const { updated, matched } = result;
  const isPartial = updated < matched;

  useEffect(() => {
    if (isPartial) return;
    const timer = setTimeout(onDismiss, SUCCESS_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [result, isPartial, onDismiss]);

  return (
    <div
      role={isPartial ? "alert" : "status"}
      className="fixed bottom-5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 card rounded-lg text-sm"
    >
      {isPartial ? (
        <TriangleAlert aria-hidden size={16} className="text-warning" />
      ) : (
        <Check aria-hidden size={16} className="text-success" />
      )}
      <span>
        {isPartial
          ? `Updated ${updated} of ${countTasks(matched)}. The rest were skipped.`
          : `Updated ${countTasks(updated)}`}
      </span>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={onDismiss}
        className="cursor-pointer rounded-md p-1 hover:bg-surface-muted"
      >
        <X aria-hidden size={14} />
      </button>
    </div>
  );
}
