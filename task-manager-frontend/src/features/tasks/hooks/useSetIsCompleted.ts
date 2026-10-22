import { useRef } from "react";
import type { Task } from "../types";
import useUpdateTask from "./useUpdateTask";
import { trackEvent } from "../../../services/analytics";

export default function useSetIsCompleted() {
  const { mutateAsync: updateTask } = useUpdateTask();
  const inFlight = useRef(new Set<number>());

  async function setIsCompleted(
    id: number,
    isCompleted: boolean,
    task?: Task,
  ) {
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);

    const completedAt = isCompleted ? new Date().toUTCString() : null;
    const expectedStartAt =
      isCompleted && task?.isRepeating && !task.isGhost
        ? task.startAt
        : undefined;

    try {
      await updateTask({
        id,
        newTaskData: { isCompleted, completedAt, expectedStartAt },
      });

      const wasOverdue = task ? new Date(task.endAt) < new Date() : undefined;
      trackEvent("task_status_changed", {
        from_status: isCompleted
          ? wasOverdue === undefined
            ? undefined
            : wasOverdue
              ? "overdue"
              : "pending"
          : "completed",
        to_status: isCompleted ? "completed" : "pending",
      });
      if (isCompleted) {
        trackEvent("task_completed", {
          category: task?.category,
          is_repeating: task ? Boolean(task.repeatBy) : undefined,
          repeat_by: task?.repeatBy ?? null,
          was_overdue: wasOverdue,
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      inFlight.current.delete(id);
    }
  }

  return setIsCompleted;
}
