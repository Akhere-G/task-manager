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
    // The cache must change in the same tick as the drop: awaiting first lets
    // dnd-kit clear its transforms and render the old order for a frame.
    onMutate: (reordered) => {
      const before = queryClient.getQueryData<Task>(queryKey);
      queryClient.setQueryData<Task>(
        queryKey,
        (task) => task && { ...task, subtasks: reordered },
      );
      queryClient.cancelQueries({ queryKey });
      return { before };
    },
    onError: (_error, _reordered, context) => {
      queryClient.setQueryData(queryKey, context?.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
