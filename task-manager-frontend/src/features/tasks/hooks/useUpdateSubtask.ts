import { taskService } from "../api";
import { patchSubtask } from "../optimistic/taskCache";
import useTaskWrite from "../optimistic/useTaskWrite";

interface SubtaskTick {
  id: number;
  parentId: number;
  isCompleted: boolean;
}

export default function useUpdateSubtask() {
  return useTaskWrite({
    mutationFn: ({ id, isCompleted }: SubtaskTick) =>
      taskService.update(id, { isCompleted }),
    apply: (queryClient, { id, parentId, isCompleted }) =>
      patchSubtask(queryClient, parentId, id, (subtask) => ({
        ...subtask,
        isCompleted,
      })),
    errorMessage: () => "Could not save the subtask",
  });
}
