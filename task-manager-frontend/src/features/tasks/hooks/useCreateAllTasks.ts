import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateTaskInput } from "../types";
import { taskService } from "../api";

export default function useCreateAllTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tasks: CreateTaskInput[]) =>
      await taskService.createAll(tasks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
