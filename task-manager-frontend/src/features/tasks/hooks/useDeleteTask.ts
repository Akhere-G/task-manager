import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "../api";
import { useTaskContext } from "../../../context/TaskContext";
import { useToast } from "../../../context/ToastContext";
import { trackEvent } from "../../../services/analytics";
import { getApiErrorMessage } from "../../../utils/errors";
import { taskWrite, type TaskWrite } from "./usePendingWrite";
import { refreshTasksAndStats } from "./refreshTasksAndStats";

export default function useDeleteTask() {
  const queryClient = useQueryClient();
  const { selectedTask } = useTaskContext();
  const { showError } = useToast();
  const refresh = () => refreshTasksAndStats(queryClient);

  const { mutate } = useMutation({
    ...taskWrite,
    mutationFn: ({ id }: TaskWrite) => taskService.delete(id),
    onSuccess: () => {
      trackEvent("task_deleted", {
        has_project: selectedTask ? selectedTask.projectId !== null : undefined,
        is_repeating: selectedTask ? Boolean(selectedTask.repeatBy) : undefined,
      });
      return refresh();
    },
    onError: (error) => {
      showError(getApiErrorMessage(error, "Could not delete the task"));
      void refresh();
    },
  });

  return (id: number) => mutate({ id, preview: null });
}
