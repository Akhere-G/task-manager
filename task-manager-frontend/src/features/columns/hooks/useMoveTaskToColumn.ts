import { useMutation, useQueryClient } from "@tanstack/react-query";

import { columnService } from "../api";
import type { BoardMoveInput } from "../types";

interface BoardMoveRequest {
  id: number;
  move: BoardMoveInput;
}

export default function useMoveTaskToColumn() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, move }: BoardMoveRequest) =>
      columnService.moveTask(id, move),
    // Returned so the mutation stays pending until the columns have loaded the
    // new order; the board shows its dropped order until then.
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["stats"] }),
      ]),
  });
}
