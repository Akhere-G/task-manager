import { taskService } from "../api";
import type { TaskUpdate } from "../types";
import { toFormattedUTCDate } from "../../../utils/formators";
import { predictUpdate } from "../optimistic/predictions";
import { patchTask } from "../optimistic/taskCache";
import useTaskWrite from "../optimistic/useTaskWrite";

interface UpdateRequest {
  id: number;
  newTaskData: TaskUpdate;
  errorMessage?: string | null;
}

const formatTask = (newTaskData: TaskUpdate): TaskUpdate => {
  const formattedData = { ...newTaskData };
  if (newTaskData.startAt)
    formattedData.startAt = toFormattedUTCDate(newTaskData.startAt);
  if (newTaskData.endAt)
    formattedData.endAt = toFormattedUTCDate(newTaskData.endAt);
  if (newTaskData.completedAt)
    formattedData.completedAt = toFormattedUTCDate(newTaskData.completedAt);
  return formattedData;
};

export default function useUpdateTask() {
  return useTaskWrite({
    mutationFn: ({ id, newTaskData }: UpdateRequest) =>
      taskService.update(id, formatTask(newTaskData)),
    apply: (queryClient, { id, newTaskData }) =>
      patchTask(queryClient, {
        taskId: id,
        change: predictUpdate(newTaskData),
      }),
    errorMessage: ({ errorMessage = "Could not save the task" }) =>
      errorMessage,
  });
}
