import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "../api";
import { useTaskContext } from "../../../context/TaskContext";
import { trackEvent } from "../../../services/analytics";

export default function useDeleteTask() {
  const queryClient = useQueryClient();
  const { selectedTask } = useTaskContext();
  return useMutation({
    mutationFn: (id: number) => taskService.delete(id),
    onSuccess: () => {
      trackEvent("task_deleted", {
        category: selectedTask?.category,
        is_repeating: selectedTask ? Boolean(selectedTask.repeatBy) : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
