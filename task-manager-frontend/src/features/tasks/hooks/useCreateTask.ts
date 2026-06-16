import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateTaskInput } from "../types";
import { taskService } from "../api";

export default function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: CreateTaskInput) => await taskService.create(task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
