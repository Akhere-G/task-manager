import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "../api";
import { trackEvent } from "../../../services/analytics";

export default function useRestoreTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => taskService.restore(id),
    onSuccess: () => {
      trackEvent("task_restored");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
