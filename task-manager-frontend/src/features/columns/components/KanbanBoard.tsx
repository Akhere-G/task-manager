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
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ColumnChoice } from "../../tasks/components/GroupActionItems";
import { createPortal } from "react-dom";
import { ErrorState, LoadingState } from "../../../components/ui";
import type { Task } from "../../tasks/types";
import {
  applyOnDrop,
  dropTask,
  type ColumnKey,
  type DropTarget,
  type TasksByColumn,
} from "../board";
import { readBoardGroups } from "../boardCache";
import { readDragRef } from "../dragRef";
import { useReorderColumns } from "../hooks/useColumnMutations";
import useColumns from "../hooks/useColumns";
import useMoveTaskToColumn from "../hooks/useMoveTaskToColumn";
import type { BoardQuery, ProjectColumn } from "../types";
import BoardTaskCard from "./BoardTaskCard";
import AddColumnForm from "./AddColumnForm";
import UnassignedColumn from "./UnassignedColumn";
import DeleteColumnDialog from "./DeleteColumnDialog";
import KanbanColumn, { columnDragId } from "./KanbanColumn";

interface KanbanBoardProps extends BoardQuery {
  projectId: number;
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
  filters,
  search,
  view,
}: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const { data: columns = [], isLoading, error } = useColumns(projectId);
  const { mutate: reorderColumns } = useReorderColumns(projectId);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<ProjectColumn | null>(null);
  const [dropped, setDropped] = useState<TasksByColumn | null>(null);
  const { mutate: moveTask } = useMoveTaskToColumn(() => setDropped(null));

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

  const shownBoard = () =>
    dropped ?? readBoardGroups(queryClient, projectId, columns);

  const handleDragStart = ({ active }: DragStartEvent) => {
    const ref = readDragRef(active.data.current);
    const tasks = [...shownBoard().values()].flat();
    setActiveTask(
      ref?.type === "task"
        ? (tasks.find((task) => task.id === ref.taskId) ?? null)
        : null,
    );
  };

  const dropOnBoard = (taskId: number, target: DropTarget) => {
    const result = dropTask(shownBoard(), taskId, target);
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
    setDropped(next);
    moveTask({ id: taskId, move: result.move, column });
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

  const moveChoices = (exceptId: number | null): ColumnChoice[] => {
    const choices: ColumnChoice[] = [{ id: null, name: "Unassigned" }];
    for (const column of columns) {
      choices.push({ id: column.id, name: column.name });
    }
    return choices.filter((choice) => choice.id !== exceptId);
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
            filters={filters}
            search={search}
            view={view}
            droppedTasks={dropped?.get(null)}
            moveChoices={moveChoices(null)}
          />
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              filters={filters}
              search={search}
              view={view}
              droppedTasks={dropped?.get(column.id)}
              moveChoices={moveChoices(column.id)}
              onDelete={() => setDeleting(column)}
            />
          ))}
          <AddColumnForm projectId={projectId} />
        </div>
      </SortableContext>
      {/* A transformed ancestor would offset the overlay's fixed position. */}
      {createPortal(
        <DragOverlay>
          {activeTask && <BoardTaskCard task={activeTask} />}
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
