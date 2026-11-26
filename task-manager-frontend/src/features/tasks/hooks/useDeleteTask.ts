import { taskService } from "../api";
import { trackEvent } from "../../../services/analytics";
import { patchTask } from "../optimistic/taskCache";
import useTaskWrite from "../optimistic/useTaskWrite";
import type { Task } from "../types";

export default function useDeleteTask() {
  return useTaskWrite({
    mutationFn: async (task: Task) => {
      await taskService.delete(task.id);
      trackEvent("task_deleted", {
        has_project: task.projectId !== null,
        is_repeating: Boolean(task.repeatBy),
      });
    },
    apply: (queryClient, { id }) =>
      patchTask(queryClient, { taskId: id, change: () => null }),
    errorMessage: () => "Could not delete the task",
  });
}
