import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "../api";
import type { Task } from "../types";
import { toFormattedUTCDate } from "../../../utils/formators";
import { taskWrite, type TaskWrite } from "./usePendingWrite";

type TaskUpdate = Partial<Task> & { skipOccurrence?: boolean };

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
  const queryClient = useQueryClient();

  const refresh = () =>
    Promise.all(
      ["tasks", "stats", "projects", "labels"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );

  return useMutation({
    ...taskWrite,
    mutationFn: ({
      id,
      newTaskData,
    }: TaskWrite & { newTaskData: TaskUpdate }) => {
      const formattedData = formatTask(newTaskData);
      return taskService.update(id, formattedData);
    },
    onSuccess: (_, { preview }) => {
      const refreshed = refresh();
      return preview ? refreshed : undefined;
    },
    onError: () => {
      void refresh();
    },
  });
}
