import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService, type GetTaskResult, type MoveInput } from "../api";
import type { Task } from "../types";

interface MoveRequest {
  id: number;
  move: MoveInput;
  reordered: Task[];
}

export default function useMoveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, move }: MoveRequest) => taskService.move(id, move),
    onMutate: async ({ id, reordered }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const before = queryClient.getQueriesData<GetTaskResult>({
        queryKey: ["tasks"],
      });
      queryClient.setQueriesData<GetTaskResult>(
        { queryKey: ["tasks"] },
        (data) =>
          data?.tasks?.some((task) => task.id === id)
            ? { ...data, tasks: reordered }
            : data,
      );
      return { before };
    },
    onError: (_error, _request, context) => {
      context?.before.forEach(([key, data]) =>
        queryClient.setQueryData(key, data),
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
