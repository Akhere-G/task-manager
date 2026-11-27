import { useMutation, useQueryClient } from "@tanstack/react-query";

import { taskService, type BulkResult, type BulkTarget } from "../api";
import { getBrowserTimeZone } from "../recurrence";
import { useTaskSelection } from "../selection/useTaskSelection";
import type { Priority, SnoozePreset } from "../types";
import { refreshTasksAndStats } from "./refreshTasksAndStats";

interface SnoozeRequest {
  target: BulkTarget;
  preset: SnoozePreset;
  day?: string;
}

interface PriorityRequest {
  target: BulkTarget;
  priority: Priority;
}

interface MoveRequest {
  target: BulkTarget;
  columnId: number | null;
}

function useBulkMutation<Request>(
  run: (request: Request) => Promise<BulkResult>,
) {
  const queryClient = useQueryClient();
  const { clear } = useTaskSelection();

  return useMutation({
    mutationFn: run,
    onSuccess: clear,
    onSettled: () => refreshTasksAndStats(queryClient),
  });
}

export default function useBulkTaskActions() {
  const complete = useBulkMutation(taskService.bulkComplete);
  const remove = useBulkMutation(taskService.bulkDelete);
  const snooze = useBulkMutation(({ target, preset, day }: SnoozeRequest) =>
    taskService.bulkSnooze(target, {
      preset,
      day,
      zoneName: getBrowserTimeZone() ?? "UTC",
    }),
  );
  const setPriority = useBulkMutation(({ target, priority }: PriorityRequest) =>
    taskService.bulkPriority(target, priority),
  );
  const move = useBulkMutation(({ target, columnId }: MoveRequest) =>
    taskService.bulkMove(target, columnId),
  );

  return { complete, remove, snooze, setPriority, move };
}
