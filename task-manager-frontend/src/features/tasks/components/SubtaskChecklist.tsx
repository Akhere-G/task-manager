import { useState } from "react";
import { Trash2 } from "lucide-react";
import useAddSubtasks from "../hooks/useAddSubtasks";
import useDeleteSubtask from "../hooks/useDeleteSubtask";
import useUpdateTask from "../hooks/useUpdateTask";
import type { Subtask } from "../types";
import SubtaskProgress from "./SubtaskProgress";

interface SubtaskChecklistProps {
  parentId: number;
  subtasks: Subtask[];
}

export default function SubtaskChecklist({
  parentId,
  subtasks,
}: SubtaskChecklistProps) {
  const [title, setTitle] = useState("");
  const { mutateAsync: addSubtasks, isPending } = useAddSubtasks(parentId);
  const { mutate: updateTask } = useUpdateTask();
  const { mutate: removeSubtask } = useDeleteSubtask();
  const done = subtasks.filter((subtask) => subtask.isCompleted).length;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    await addSubtasks([{ title: trimmed }]);
    setTitle("");
  }

  return (
    <section aria-label="Subtasks" className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="font-semibold text-text-main">Subtasks</h3>
        {subtasks.length > 0 && (
          <span className="text-sm text-text-sub">
            {done}/{subtasks.length}
          </span>
        )}
      </header>
      <SubtaskProgress done={done} total={subtasks.length} />
      <ul className="flex flex-col gap-1">
        {subtasks.map((subtask) => (
          <li key={subtask.id} className="flex items-center gap-2">
            <label className="flex items-center gap-2 grow text-text-main">
              <input
                type="checkbox"
                checked={subtask.isCompleted}
                onChange={(e) =>
                  updateTask({
                    id: subtask.id,
                    newTaskData: { isCompleted: e.target.checked },
                  })
                }
              />
              <span className={subtask.isCompleted ? "line-through" : ""}>
                {subtask.title}
              </span>
            </label>
            <button
              type="button"
              aria-label={`Delete subtask ${subtask.title}`}
              className="p-1 text-text-sub hover:text-failure cursor-pointer"
              onClick={() => removeSubtask(subtask.id)}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          aria-label="New subtask"
          placeholder="Add a subtask"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={255}
          className="grow p-2 rounded-xl border border-border-light focus:outline-none focus:border-brand bg-bg-secondary text-text-main"
        />
        <button
          type="submit"
          className="btn-secondary"
          disabled={isPending || !title.trim()}
        >
          Add
        </button>
      </form>
    </section>
  );
}
