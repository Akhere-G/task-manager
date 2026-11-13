import { Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useCreateColumn } from "../hooks/useColumnMutations";

export default function AddColumnForm({ projectId }: { projectId: number }) {
  const [name, setName] = useState("");
  const { mutate: createColumn, isPending, error } = useCreateColumn(projectId);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed)
      createColumn({ name: trimmed }, { onSuccess: () => setName("") });
  };

  return (
    <form
      onSubmit={submit}
      className="flex h-fit w-72 shrink-0 flex-col gap-2 rounded-xl border-2 border-dashed border-slate-200 p-3 dark:border-slate-800"
    >
      <input
        aria-label="New column name"
        value={name}
        maxLength={50}
        onChange={(event) => setName(event.target.value)}
        placeholder="New column"
        className="rounded-lg border border-slate-300 bg-canvas px-2 py-1 text-sm text-text-main dark:border-slate-700"
      />
      <button
        type="submit"
        disabled={isPending || !name.trim()}
        className="btn-secondary flex items-center justify-center gap-1 text-sm"
      >
        <Plus size={14} aria-hidden />
        Add column
      </button>
      {error && (
        <p role="alert" className="text-xs text-failure">
          Could not add the column. The name may already be used.
        </p>
      )}
    </form>
  );
}
