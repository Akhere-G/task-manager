import type { QueryKey } from "@tanstack/react-query";
import { taskService, type MoveInput } from "../api";
import { reorderList } from "../optimistic/taskCache";
import useTaskWrite from "../optimistic/useTaskWrite";
import type { Task } from "../types";

interface MoveRequest {
  id: number;
  move: MoveInput;
  reordered: Task[];
  queryKey: QueryKey;
}

export default function useMoveTask() {
  return useTaskWrite({
    mutationFn: ({ id, move }: MoveRequest) => taskService.move(id, move),
    apply: (queryClient, { id, reordered, queryKey }) =>
      reorderList(queryClient, queryKey, id, reordered),
  });
}
