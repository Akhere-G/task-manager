import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "../api";

import type { Task } from "../types";

export default function useUpdateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      newTaskData,
    }: {
      id: number;
      newTaskData: Partial<Task>;
    }) => taskService.update(id, newTaskData),
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
            task.id === id ? { ...task, ...newTaskData } : task,
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
