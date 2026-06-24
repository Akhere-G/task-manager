import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateTaskInput } from "../types";
import { taskService } from "../api";
import { toFormattedUTCDate } from "../../../utils/formators";

export default function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (task: CreateTaskInput) => {
      const formattedData = {
        ...task,
        startAt: toFormattedUTCDate(task.startAt),
        endAt: toFormattedUTCDate(task.endAt),
      };
      await taskService.create(formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
