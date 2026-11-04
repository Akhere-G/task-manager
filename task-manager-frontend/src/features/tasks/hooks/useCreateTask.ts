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
        startAt: task.startAt ? toFormattedUTCDate(task.startAt) : null,
        endAt: task.endAt ? toFormattedUTCDate(task.endAt) : null,
      };
      await taskService.create(formattedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["labels"] });
    },
  });
}
