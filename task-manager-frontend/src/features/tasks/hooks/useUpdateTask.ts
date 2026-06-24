import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "../api";

import type { Task } from "../types";
import { toFormattedUTCDate } from "../../../utils/formators";

const formatTask = (newTaskData: Partial<Task>): Partial<Task> => {
  const formattedData = {
    ...newTaskData,
  };

  if (newTaskData.startAt) {
    formattedData.startAt = toFormattedUTCDate(newTaskData.startAt);
  }

  if (newTaskData.endAt) {
    formattedData.endAt = toFormattedUTCDate(newTaskData.endAt);
  }

  if (newTaskData.completedAt) {
    formattedData.completedAt = toFormattedUTCDate(newTaskData.completedAt);
  }

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    onMutate: async ({ id, newTaskData }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });

      const previousTasks = queryClient.getQueryData<Task[]>(["tasks"]);

      if (previousTasks) {
        queryClient.setQueryData<Task[]>(["tasks"], (old) =>
          old?.map((task) =>
            task.id === id ? { ...task, ...formatTask(newTaskData) } : task,
          ),
        );
      }

      return { previousTasks };
    },
    onError: (err, _, context) => {
      console.error("Task update failed, rolling back.", err);
      if (context?.previousTasks) {
        queryClient.setQueryData(["tasks"], context.previousTasks);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
