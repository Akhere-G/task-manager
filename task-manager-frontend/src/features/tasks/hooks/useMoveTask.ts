import {
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryKey,
} from "@tanstack/react-query";
import { taskService, type GetTaskResult, type MoveInput } from "../api";
import type { Task } from "../types";

interface MoveRequest {
  id: number;
  move: MoveInput;
  reordered: Task[];
  queryKey: QueryKey;
}

const withOrder = (
  data: InfiniteData<GetTaskResult>,
  reordered: Task[],
): InfiniteData<GetTaskResult> => {
  let offset = 0;
  const pages = data.pages.map((page) => {
    const tasks = reordered.slice(offset, offset + page.tasks.length);
    offset += page.tasks.length;
    return { ...page, tasks };
  });
  return { ...data, pages };
};

export default function useMoveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, move }: MoveRequest) => taskService.move(id, move),
    // The cache must change in the same tick as the drop: awaiting first lets
    // dnd-kit clear its transforms and render the old order for a frame.
    onMutate: ({ reordered, queryKey }) => {
      const before = queryClient.getQueryData<InfiniteData<GetTaskResult>>(
        queryKey,
      );
      queryClient.setQueryData<InfiniteData<GetTaskResult>>(queryKey, (data) =>
        data && withOrder(data, reordered),
      );
      queryClient.cancelQueries({ queryKey });
      return { before };
    },
    onError: (_error, { queryKey }, context) => {
      queryClient.setQueryData(queryKey, context?.before);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
