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
    // The cache must change in the same tick as the drop: awaiting first lets
    // dnd-kit clear its transforms and render the old order for a frame.
    onMutate: ({ id, reordered }) => {
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
      queryClient.cancelQueries({ queryKey: ["tasks"] });
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
