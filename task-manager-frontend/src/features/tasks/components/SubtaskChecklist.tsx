import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState } from "react";
import useAddSubtasks from "../hooks/useAddSubtasks";
import useReorderSubtasks from "../hooks/useReorderSubtasks";
import { reorder } from "../order";
import type { Subtask } from "../types";
import { SubtaskItem } from "./SubtaskItem";
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
  const {
    mutate: addSubtasks,
    isPending,
    isError,
  } = useAddSubtasks(parentId);
  const { mutate: reorderSubtasks } = useReorderSubtasks(parentId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const done = subtasks.filter((subtask) => subtask.isCompleted).length;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    addSubtasks([{ title: trimmed }], { onSuccess: () => setTitle("") });
  }

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const result =
      over && reorder(subtasks, Number(active.id), Number(over.id));
    if (result) reorderSubtasks(result.items);
  };

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
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={subtasks.map((subtask) => subtask.id)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="flex flex-col gap-1">
            {subtasks.map((subtask) => (
              <SubtaskItem key={subtask.id} subtask={subtask} />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
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
      {isError && (
        <p role="alert" className="text-sm text-failure">
          Could not add the subtask
        </p>
      )}
    </section>
  );
}
