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

  const resolve = (taskId: number) =>
    setResolvedTaskIds((ids) => [...ids, taskId]);

  const accept = ({ taskId, suggestedPriority }: PrioritySuggestion) =>
    updateTask(
      { id: taskId, newTaskData: { priority: suggestedPriority } },
      { onSuccess: () => resolve(taskId) },
    );

  const requestSuggestions = () => {
    setResolvedTaskIds([]);
    suggest.mutate();
    trackEvent("ai_priorities_suggested");
  };

  const pending = suggest.data?.filter(
    ({ taskId }) => !resolvedTaskIds.includes(taskId),
  );

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
      {pending?.map((suggestion) => (
        <div
          key={suggestion.taskId}
          className="card flex flex-wrap items-center justify-between gap-2"
        >
          <div>
            <p className="font-semibold text-text-main">{suggestion.title}</p>
            <p className="text-xs text-text-sub">
              P{suggestion.currentPriority} → P{suggestion.suggestedPriority}.{" "}
              {suggestion.reason}
            </p>
          </div>
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
