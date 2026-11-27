import type { Priority, Task } from "../types";
import { taskMinutes, taskTargetId } from "../utils";
import { usePendingWrites } from "./usePendingWrite";

interface QuadrantTasks {
  tasks: Task[];
  total: number;
  totalMinutes: number;
}

const sumMinutes = (tasks: Task[]) =>
  tasks.reduce((sum, task) => sum + taskMinutes(task), 0);

export default function useQuadrantTasks(
  priority: Priority,
  loaded: QuadrantTasks,
  isShown: boolean,
): QuadrantTasks {
  const moves = usePendingWrites().flatMap(({ movedTask, preview }) =>
    movedTask && preview?.priority
      ? [{ task: movedTask, to: preview.priority }]
      : [],
  );
  const isLeaving = (task: Task) =>
    moves.some(
      (move) =>
        move.to !== priority && taskTargetId(move.task) === taskTargetId(task),
    );
  const isLoaded = (task: Task) =>
    loaded.tasks.some((other) => taskTargetId(other) === taskTargetId(task));

  const leaving = loaded.tasks.filter(isLeaving);
  const arriving = moves
    .filter((move) => isShown && move.to === priority && !isLoaded(move.task))
    .map((move) => move.task);

  return {
    tasks: [...arriving, ...loaded.tasks.filter((task) => !isLeaving(task))],
    total: loaded.total + arriving.length - leaving.length,
    totalMinutes:
      loaded.totalMinutes + sumMinutes(arriving) - sumMinutes(leaving),
  };
}
