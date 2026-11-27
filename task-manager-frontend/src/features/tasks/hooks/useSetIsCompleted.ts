import type { Task } from "../types";
import useUpdateTask from "./useUpdateTask";
import { trackEvent } from "../../../services/analytics";
import { playSound } from "../utils";
import { useToast } from "../../../context/ToastContext";

export default function useSetIsCompleted() {
  const { mutateAsync: updateTask, isPending, isIdle } = useUpdateTask();
  const { showError } = useToast();

  async function setIsCompleted(
    id: number,
    isCompleted: boolean,
    task?: Task,
  ): Promise<boolean> {
    const completedAt = isCompleted ? new Date().toUTCString() : null;

    if (isCompleted) playSound("/success.mp3").catch(() => {});

    try {
      await updateTask({
        id,
        newTaskData: { isCompleted, completedAt },
        preview: { isCompleted },
      });

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
      return true;
    } catch {
      showError(
        isCompleted
          ? "Could not complete the task"
          : "Could not reopen the task",
      );
      return false;
    }
  }

  return { setIsCompleted, isPending, isIdle };
}
