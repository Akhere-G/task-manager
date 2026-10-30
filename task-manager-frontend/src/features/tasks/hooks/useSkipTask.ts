import type { Task } from "../types";
import useUpdateTask from "./useUpdateTask";
import { trackEvent } from "../../../services/analytics";

export default function useSkipTask(props?: { onSkip?: () => void }) {
  const { onSkip } = props ?? {};
  const { mutateAsync: updateTask } = useUpdateTask();
  async function skipTask(task: Task) {
    try {
      if (!task.repeatBy) return;

      await updateTask({
        id: task.id,
        newTaskData: { skipOccurrence: true },
      });
      trackEvent("recurring_task_skipped", { repeat_by: task.repeatBy });
      onSkip?.();
    } catch (err) {
      console.error(err);
    }
  }

  return skipTask;
}
