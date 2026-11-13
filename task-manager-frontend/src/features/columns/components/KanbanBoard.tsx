import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useState } from "react";
import { createPortal } from "react-dom";
import { ErrorState, LoadingState } from "../../../components/ui";
import TaskCardSmallConnected from "../../tasks/components/TaskCardSmall";
import type { Task } from "../../tasks/types";
import {
  applyOnDrop,
  dropTask,
  groupByColumn,
  type ColumnKey,
  type DropTarget,
  type TasksByColumn,
} from "../board";
import { readDragRef } from "../dragRef";
import { useReorderColumns } from "../hooks/useColumnMutations";
import useColumns from "../hooks/useColumns";
import useMoveTaskToColumn from "../hooks/useMoveTaskToColumn";
import type { ProjectColumn } from "../types";
import AddColumnForm from "./AddColumnForm";
import UnassignedColumn from "./UnassignedColumn";
import DeleteColumnDialog from "./DeleteColumnDialog";
import KanbanColumn, { columnDragId } from "./KanbanColumn";

interface KanbanBoardProps {
  projectId: number;
  tasks: Task[];
}

const collide: CollisionDetection = (args) => {
  const typeOf = (id: string | number) =>
    readDragRef(
      args.droppableContainers.find((container) => container.id === id)?.data
        .current,
    )?.type;

  if (readDragRef(args.active.data.current)?.type === "column") {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => typeOf(container.id) === "column",
      ),
    });
  }
  const pointerHits = pointerWithin(args);
  const hits = pointerHits.length > 0 ? pointerHits : rectIntersection(args);
  const hit =
    hits.find((candidate) => typeOf(candidate.id) === "task") ??
    hits.find((candidate) => typeOf(candidate.id) !== "task");
  return hit ? [hit] : [];
};

export default function KanbanBoard({
  projectId,
  tasks: loaded,
}: KanbanBoardProps) {
  const { data: columns = [], isLoading, error } = useColumns(projectId);
  const { mutate: moveTask } = useMoveTaskToColumn();
  const { mutate: reorderColumns } = useReorderColumns(projectId);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<ProjectColumn | null>(null);
  // See TaskList: show the dropped board until the cache catches up.
  const [dropped, setDropped] = useState<{
    from: Task[];
    to: TasksByColumn;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  if (error) return <ErrorState error="Could not get the board columns" />;
  if (isLoading) return <LoadingState loadMessage="Getting columns..." />;

  const boardTasks = loaded.filter(
    (task) =>
      task.projectId === projectId && !task.isGhost && task.parentId === null,
  );
  const groups =
    dropped?.from === loaded ? dropped.to : groupByColumn(boardTasks, columns);
  const tasksById = new Map(boardTasks.map((task) => [task.id, task]));

  const handleDragStart = ({ active }: DragStartEvent) => {
    const ref = readDragRef(active.data.current);
    setActiveTask(
      ref?.type === "task" ? (tasksById.get(ref.taskId) ?? null) : null,
    );
  };

  const dropOnBoard = (taskId: number, target: DropTarget) => {
    const result = dropTask(groups, taskId, target);
    if (!result) return;
    const column =
      columns.find((candidate) => candidate.id === result.move.columnId) ??
      null;
    if (result.move.columnId !== null && column === null) return;

    const keys: ColumnKey[] = [null, ...columns.map((c) => c.id)];
    const next: TasksByColumn = new Map(
      keys.map((key) => [
        key,
        (result.columns.get(key) ?? []).flatMap((task) => {
          if (task.id !== taskId) return [task];
          const moved = applyOnDrop(task, column);
          return moved ? [moved] : [];
        }),
      ]),
    );
    setDropped({ from: loaded, to: next });
    moveTask({
      id: taskId,
      move: result.move,
      board: keys.flatMap((key) => next.get(key) ?? []),
    });
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveTask(null);
    const from = readDragRef(active.data.current);
    const to = readDragRef(over?.data.current);
    if (!from || !to) return;

    if (from.type === "column" && to.type === "column") {
      const ids = columns.map((column) => column.id);
      const next = arrayMove(
        ids,
        ids.indexOf(from.columnId),
        ids.indexOf(to.columnId),
      );
      if (next.some((id, index) => id !== ids[index])) reorderColumns(next);
    } else if (from.type === "task") {
      if (to.type === "task") {
        dropOnBoard(from.taskId, { type: "task", taskId: to.taskId });
      } else {
        const columnId = to.type === "column" ? to.columnId : null;
        dropOnBoard(from.taskId, { type: "column", columnId });
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collide}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <SortableContext
        items={columns.map((column) => columnDragId(column.id))}
        strategy={horizontalListSortingStrategy}
      >
        <div
          aria-label="Kanban board"
          className="flex items-start gap-3 overflow-x-auto pb-4"
        >
          <UnassignedColumn
            projectId={projectId}
            tasks={groups.get(null) ?? []}
          />
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={groups.get(column.id) ?? []}
              onDelete={() => setDeleting(column)}
            />
          ))}
          <AddColumnForm projectId={projectId} />
        </div>
      </SortableContext>
      {/* A transformed ancestor would offset the overlay's fixed position. */}
      {createPortal(
        <DragOverlay>
          {activeTask && <TaskCardSmallConnected {...activeTask} />}
        </DragOverlay>,
        document.body,
      )}
      {deleting && (
        <DeleteColumnDialog
          column={deleting}
          otherColumns={columns.filter((column) => column.id !== deleting.id)}
          close={() => setDeleting(null)}
        />
      )}
    </DndContext>
  );
}
