import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "../api";
import type { Subtask, Task } from "../types";

export default function useReorderSubtasks(parentId: number) {
  const queryClient = useQueryClient();
  const queryKey = ["tasks", { id: parentId }];

  return useMutation({
    mutationFn: (reordered: Subtask[]) =>
      taskService.reorderSubtasks(
        parentId,
        reordered.map((subtask) => subtask.id),
      ),
    onMutate: async (reordered) => {
      await queryClient.cancelQueries({ queryKey });
      const before = queryClient.getQueryData<Task>(queryKey);
      queryClient.setQueryData<Task>(
        queryKey,
        (task) => task && { ...task, subtasks: reordered },
      );
      return { before };
    },
    onError: (_error, _reordered, context) => {
      queryClient.setQueryData(queryKey, context?.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
