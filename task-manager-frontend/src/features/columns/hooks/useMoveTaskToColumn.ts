import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { GetTaskResult } from "../../tasks/api";
import type { Task } from "../../tasks/types";
import { columnService } from "../api";
import type { BoardMoveInput } from "../types";

interface BoardMoveRequest {
  id: number;
  move: BoardMoveInput;
  /** Every task on the board after the drop, in order; leaves out a deleted one. */
  board: Task[];
}

export default function useMoveTaskToColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, move }: BoardMoveRequest) =>
      columnService.moveTask(id, move),
    // Same as useMoveTask: the cache changes in the drop's own tick so dnd-kit
    // never renders the old order.
    onMutate: ({ id, board }) => {
      const before = queryClient.getQueriesData<GetTaskResult>({
        queryKey: ["tasks"],
      });
      const onBoard = new Set([id, ...board.map((task) => task.id)]);
      queryClient.setQueriesData<GetTaskResult>(
        { queryKey: ["tasks"] },
        (data) =>
          data?.tasks?.some((task) => task.id === id)
            ? {
                ...data,
                tasks: [
                  ...data.tasks.filter((task) => !onBoard.has(task.id)),
                  ...board,
                ],
              }
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
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
