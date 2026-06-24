import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "../api";
import type { Task } from "../types";
import { toFormattedUTCDate } from "../../../utils/formators";

const formatTask = (newTaskData: Partial<Task>): Partial<Task> => {
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      newTaskData,
    }: {
      id: number;
      newTaskData: Partial<Task>;
    }) => {
      const formattedData = formatTask(newTaskData);
      return taskService.update(id, formattedData);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
