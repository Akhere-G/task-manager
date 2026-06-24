import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { CreateTaskInput } from "../types";
import { taskService } from "../api";
import { toFormattedUTCDate } from "../../../utils/formators";

interface Task extends CreateTaskInput {
  completedAt?: string | null;
  createdAt?: string | null;
}
export default function useCreateAllTasks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tasks: Task[]) => {
      const formattedTasks = tasks.map((task) => ({
        ...task,

        startAt: toFormattedUTCDate(task.startAt),
        endAt: toFormattedUTCDate(task.endAt),
        completedAt: task.completedAt
          ? toFormattedUTCDate(task.completedAt)
          : null,
        createdAt: task.createdAt ? toFormattedUTCDate(task.createdAt) : null,
      }));
      await taskService.createAll(formattedTasks);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
