import type { Task } from "../types";
import useUpdateTask from "./useUpdateTask";
import { trackEvent } from "../../../services/analytics";

export default function useSetIsCompleted() {
  const { mutateAsync: updateTask, isPending } = useUpdateTask();

  async function setIsCompleted(id: number, isCompleted: boolean, task?: Task) {
    const completedAt = isCompleted ? new Date().toUTCString() : null;

    try {
      await updateTask({ id, newTaskData: { isCompleted, completedAt } });

      const wasOverdue = task?.endAt
        ? new Date(task.endAt) < new Date()
        : undefined;
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
          has_project: task ? task.projectId !== null : undefined,
          is_repeating: task ? Boolean(task.repeatBy) : undefined,
          repeat_by: task?.repeatBy ?? null,
          was_overdue: wasOverdue,
        });
      }
    } catch (err) {
      console.error(err);
    }
  }

  return { setIsCompleted, isPending };
}
