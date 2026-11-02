import { useState } from "react";
import { Plus } from "lucide-react";
import useCreateTask from "../hooks/useCreateTask";
import { DEFAULT_PRIORITY } from "../types";
import { trackEvent } from "../../../services/analytics";

export default function QuickCapture() {
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const { mutateAsync: createTask, isPending } = useCreateTask();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      await createTask({
        title: trimmed,
        description: null,
        projectId: null,
        priority: DEFAULT_PRIORITY,
        startAt: null,
        endAt: null,
      });
      trackEvent("task_created", { source: "quick_capture" });
      setTitle("");
      setError("");
    } catch {
      setError("Could not add the task. Try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          aria-label="Quick capture"
          placeholder="Capture a task. Sort it out later."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={255}
          className="grow p-3 rounded-xl border border-border-light focus:outline-none focus:border-brand bg-bg-secondary text-text-main"
        />
        <button
          type="submit"
          className="btn-primary flex items-center gap-1"
          disabled={isPending || !title.trim()}
        >
          <Plus size={18} />
          Capture
        </button>
      </div>
      {error && (
        <p role="alert" className="text-failure">
          {error}
        </p>
      )}
    </form>
  );
}
