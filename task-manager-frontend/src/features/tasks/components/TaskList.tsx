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
import { useMemo, useState } from "react";
import { groupTasksByDate } from "../dateGroups";
import useMoveTask from "../hooks/useMoveTask";
import { reorder } from "../order";
import type { Task } from "../types";
import DateGroupHeader from "./DateGroupHeader";
import TaskRow from "./TaskRow";

interface TaskListProps {
  tasks: Task[];
  /** Lets the user drag rows into a new order. */
  sortable?: boolean;
  /** Puts rows under Overdue, Today, Tomorrow and Upcoming headers. */
  groupByDate?: boolean;
}

const itemClass =
  "transition-all duration-150 animate-in fade-in slide-in-from-bottom-2";
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

export default function TaskList({
  tasks: loaded,
  sortable = false,
  groupByDate = false,
}: TaskListProps) {
  // React Query tells its subscribers a task later than dnd-kit clears its
  // offsets, which flashes the old order. Show the dropped order until the
  // cache catches up; it is ignored as soon as `loaded` is a new list.
  const [dropped, setDropped] = useState<{ from: Task[]; to: Task[] } | null>(
    null,
  );
  const tasks = dropped?.from === loaded ? dropped.to : loaded;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
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

  const groups = useMemo(
    () => (groupByDate && !sortable ? groupTasksByDate(tasks) : null),
    [groupByDate, sortable, tasks],
  );

  const toggleGroup = (key: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (!next.delete(key)) next.add(key);
      return next;
    });

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

  if (groups) {
    return (
      <div>
        {groups.map((group) => {
          const isOpen = !collapsed.has(group.key);
          return (
            <section key={group.key} aria-label={group.label}>
              <DateGroupHeader
                group={group}
                isOpen={isOpen}
                onToggle={() => toggleGroup(group.key)}
              />
              {isOpen && (
                <ul>
                  {group.tasks.map((task) => (
                    <li key={task.id} className={itemClass}>
                      <TaskRow task={task} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  if (!sortable) {
    return (
      <ul>
        {tasks.map((task) => (
          <li key={task.id} className={itemClass}>
            <TaskRow task={task} />
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
