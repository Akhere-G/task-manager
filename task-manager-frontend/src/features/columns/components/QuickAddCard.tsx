import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import useCreateTask from "../../tasks/hooks/useCreateTask";
import { DEFAULT_PRIORITY } from "../../tasks/types";

interface QuickAddCardProps {
  projectId: number;
  columnId: number | null;
  columnName: string;
}

export default function QuickAddCard({
  projectId,
  columnId,
  columnName,
}: QuickAddCardProps) {
  const [title, setTitle] = useState<string | null>(null);
  const { mutate: createTask, isPending } = useCreateTask();

  if (title === null) {
    return (
      <button
        type="button"
        onClick={() => setTitle("")}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-text-sub hover:bg-brand/10"
      >
        <Plus size={14} aria-hidden />
        Add task
      </button>
    );
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    createTask(
      {
        title: trimmed,
        description: null,
        projectId,
        columnId,
        priority: DEFAULT_PRIORITY,
        startAt: null,
        endAt: null,
      },
      { onSuccess: () => setTitle("") },
    );
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-1">
      <input
        autoFocus
        aria-label={`New task in ${columnName}`}
        value={title}
        disabled={isPending}
        onChange={(event) => setTitle(event.target.value)}
        onKeyDown={(event) => event.key === "Escape" && setTitle(null)}
        placeholder="Task title"
        className="rounded-lg border border-slate-300 bg-canvas px-2 py-1 text-sm text-text-main dark:border-slate-700"
      />
      <span className="flex gap-2">
        <button type="submit" className="btn-primary px-2 py-1 text-sm">
          Add
        </button>
        <button
          type="button"
          onClick={() => setTitle(null)}
          className="btn-secondary px-2 py-1 text-sm"
        >
          Cancel
        </button>
      </span>
    </form>
  );
}
