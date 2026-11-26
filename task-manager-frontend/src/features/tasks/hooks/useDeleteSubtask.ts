import { taskService } from "../api";
import { patchSubtask } from "../optimistic/taskCache";
import useTaskWrite from "../optimistic/useTaskWrite";
import type { Subtask } from "../types";

export default function useDeleteSubtask() {
  return useTaskWrite({
    mutationFn: ({ id }: Subtask) => taskService.delete(id),
    apply: (queryClient, { id, parentId }) =>
      patchSubtask(queryClient, parentId, id, () => null),
    errorMessage: () => "Could not delete the subtask",
  });
}
