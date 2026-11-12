import { Sparkles } from "lucide-react";
import { useState } from "react";
import { trackEvent } from "../../../services/analytics";
import useUpdateTask from "../../tasks/hooks/useUpdateTask";
import type { PrioritySuggestion } from "../api";
import { useSuggestPriorities } from "../hooks";

export default function PrioritySuggestions() {
  const suggest = useSuggestPriorities();
  const { mutate: updateTask } = useUpdateTask();
  const [resolvedTaskIds, setResolvedTaskIds] = useState<number[]>([]);
  const [deselectedTaskIds, setDeselectedTaskIds] = useState<number[]>([]);

  const resolve = (taskId: number) =>
    setResolvedTaskIds((ids) => [...ids, taskId]);

  const toggleSelected = (taskId: number) =>
    setDeselectedTaskIds((ids) =>
      ids.includes(taskId)
        ? ids.filter((id) => id !== taskId)
        : [...ids, taskId],
    );

  const accept = ({ taskId, suggestedPriority }: PrioritySuggestion) =>
    updateTask(
      { id: taskId, newTaskData: { priority: suggestedPriority } },
      { onSuccess: () => resolve(taskId) },
    );

  const requestSuggestions = () => {
    setResolvedTaskIds([]);
    setDeselectedTaskIds([]);
    suggest.mutate();
    trackEvent("ai_priorities_suggested");
  };

  const pending = suggest.data?.filter(
    ({ taskId }) => !resolvedTaskIds.includes(taskId),
  );
  const selected =
    pending?.filter(({ taskId }) => !deselectedTaskIds.includes(taskId)) ?? [];

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={requestSuggestions}
        disabled={suggest.isPending}
        className="btn-primary flex items-center gap-2 self-start"
      >
        <Sparkles size={16} aria-hidden />
        {suggest.isPending ? "Thinking..." : "Suggest priorities"}
      </button>
      {suggest.isError && (
        <p role="alert" className="text-failure">
          Could not get suggestions
        </p>
      )}
      {pending?.length === 0 && (
        <p className="text-text-sub">No priority changes suggested.</p>
      )}
      {pending && pending.length > 0 && (
        <button
          type="button"
          className="btn-primary self-start"
          disabled={selected.length === 0}
          onClick={() => selected.forEach(accept)}
        >
          Accept selected ({selected.length})
        </button>
      )}
      {pending?.map((suggestion) => (
        <div
          key={suggestion.taskId}
          className="card flex flex-wrap items-center justify-between gap-2"
        >
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              aria-label={`Select ${suggestion.title}`}
              checked={!deselectedTaskIds.includes(suggestion.taskId)}
              onChange={() => toggleSelected(suggestion.taskId)}
            />
            <span>
              <span className="block font-semibold text-text-main">
                {suggestion.title}
              </span>
              <span className="block text-xs text-text-sub">
                P{suggestion.currentPriority} → P{suggestion.suggestedPriority}.{" "}
                {suggestion.reason}
              </span>
            </span>
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary"
              onClick={() => accept(suggestion)}
            >
              Accept
            </button>
            <button type="button" onClick={() => resolve(suggestion.taskId)}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
