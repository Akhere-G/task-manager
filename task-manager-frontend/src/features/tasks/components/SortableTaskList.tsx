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
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";

import useMoveTask from "../hooks/useMoveTask";
import { reorder } from "../order";
import type { Task } from "../types";
import TaskRow from "./TaskRow";

// dnd-kit owns transform and transition here; CSS transitions or slide-in
// animations on the same element make the dragged row trail the pointer.
// Rows are dropped where the pointer left them, so animating from the old
// slot to the new one only makes the dropped row fly in from the side.
const sortableItemClass = "touch-manipulation";
const draggingClass = "relative z-10 cursor-grabbing shadow-lg";

function SortableItem({
  task,
  children,
}: {
  task: Task;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: task.isGhost,
    animateLayoutChanges: () => false,
  });

  return (
    <li
      ref={(node) => {
        setNodeRef(node);
        // Without an activator, Enter or Space on a button inside the row starts a drag.
        setActivatorNodeRef(node);
      }}
      className={`${sortableItemClass} ${isDragging ? draggingClass : ""}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      role="listitem"
    >
      {children}
    </li>
  );
}

export default function SortableTaskList({ tasks: loaded }: { tasks: Task[] }) {
  // React Query tells its subscribers a task later than dnd-kit clears its
  // offsets, which flashes the old order. Show the dropped order until the
  // cache catches up; it is ignored as soon as `loaded` is a new list.
  const [dropped, setDropped] = useState<{ from: Task[]; to: Task[] } | null>(
    null,
  );
  const tasks = dropped?.from === loaded ? dropped.to : loaded;
  const { mutate: moveTask } = useMoveTask();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const result = over && reorder(tasks, Number(active.id), Number(over.id));
    if (result) {
      setDropped({ from: loaded, to: result.items });
      moveTask({
        id: Number(active.id),
        move: result.move,
        reordered: result.items,
      });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul aria-label="Drag to reorder">
          {tasks.map((task) => (
            <SortableItem key={task.id} task={task}>
              <TaskRow task={task} />
            </SortableItem>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
