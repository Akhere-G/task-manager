import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "../api";
import type { SubtaskInput } from "../types";
import { refreshTasksAndStats } from "./refreshTasksAndStats";

export default function useReplaceSubtasks(parentId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (subtasks: SubtaskInput[]) =>
      taskService.replaceSubtasks(parentId, subtasks),
    onSettled: () => refreshTasksAndStats(queryClient),
  });
}
