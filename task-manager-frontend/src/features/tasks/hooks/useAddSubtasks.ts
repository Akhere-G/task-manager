import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "../api";
import type { SubtaskInput } from "../types";

export default function useAddSubtasks(parentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subtasks: SubtaskInput[]) =>
      taskService.addSubtasks(parentId, subtasks),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
