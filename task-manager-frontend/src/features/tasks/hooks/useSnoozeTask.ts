import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "../api";
import { getBrowserTimeZone } from "../recurrence";
import type { SnoozePreset, Task } from "../types";
import { toFormattedUTCDate } from "../../../utils/formators";
import { trackEvent } from "../../../services/analytics";

export interface SnoozeRequest {
  task: Task;
  preset: SnoozePreset;
  day?: string;
}

export default function useSnoozeTask(props?: { onSnooze?: () => void }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ task, preset, day }: SnoozeRequest) =>
      taskService.snooze(task.isGhost ? task.seriesId : task.id, {
        preset,
        day,
        zoneName: getBrowserTimeZone() ?? "UTC",
        ...(task.isGhost && task.startAt
          ? { isGhost: true, previousStartAt: toFormattedUTCDate(task.startAt) }
          : {}),
      }),
    onSuccess: (_, { preset }) => {
      trackEvent("task_snoozed", { preset });
      props?.onSnooze?.();
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
