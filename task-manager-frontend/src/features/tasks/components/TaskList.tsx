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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import useMoveTask from "../hooks/useMoveTask";
import { reorder } from "../order";
import type { Task } from "../types";
import TaskCard from "./TaskCard";
import TaskCardSmallConnected from "./TaskCardSmall";

interface TaskListProps {
  tasks: Task[];
  /** Lets the user drag cards into a new order. */
  sortable?: boolean;
}

const itemClass =
  "transition-all duration-150 animate-in fade-in slide-in-from-bottom-2";
// dnd-kit owns transform and transition here; CSS transitions or slide-in
// animations on the same element make the dragged card trail the pointer.
// Cards are dropped where the pointer left them, so animating from the old
// slot to the new one only makes the dropped card fly in from the side.
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
      ref={setNodeRef}
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

export default function TaskList({
  tasks: loaded,
  sortable = false,
}: TaskListProps) {
  // React Query tells its subscribers a task later than dnd-kit clears its
  // offsets, which flashes the old order. Show the dropped order until the
  // cache catches up; it is ignored as soon as `loaded` is a new list.
  const [dropped, setDropped] = useState<{ from: Task[]; to: Task[] } | null>(
    null,
  );
  const tasks = dropped?.from === loaded ? dropped.to : loaded;
  const breakpoint = useBreakpoint();
  const isMobile = ["xs", "sm"].includes(breakpoint);
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

  const card = (task: Task) =>
    isMobile ? <TaskCardSmallConnected {...task} /> : <TaskCard {...task} />;

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    const result = over && reorder(tasks, Number(active.id), Number(over.id));
    if (result) {
      setDropped({ from: loaded, to: result.tasks });
      moveTask({
        id: Number(active.id),
        move: result.move,
        reordered: result.tasks,
      });
    }
  };

  const gridClass =
    "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-6";

  if (!sortable) {
    return (
      <ul className={gridClass}>
        {tasks.map((task) => (
          <li key={task.id} className={itemClass}>
            {card(task)}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={rectSortingStrategy}
      >
        <ul className={gridClass} aria-label="Drag to reorder">
          {tasks.map((task) => (
            <SortableItem key={task.id} task={task}>
              {card(task)}
            </SortableItem>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
