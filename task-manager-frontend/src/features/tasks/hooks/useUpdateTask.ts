import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "../../../services/api";
import type { Task } from "../types";

export default function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      newTaskData,
    }: {
      id: number;
      newTaskData: Partial<Task>;
    }) => taskService.update(id, newTaskData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
