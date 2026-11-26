import { taskService } from "../api";
import { getBrowserTimeZone } from "../recurrence";
import type { SnoozePreset, Task } from "../types";
import { toFormattedUTCDate } from "../../../utils/formators";
import { trackEvent } from "../../../services/analytics";
import { predictSnooze } from "../optimistic/predictions";
import { patchTask } from "../optimistic/taskCache";
import useTaskWrite from "../optimistic/useTaskWrite";
import { taskTargetId } from "../utils";

export interface SnoozeRequest {
  task: Task;
  preset: SnoozePreset;
  day?: string;
}

export default function useSnoozeTask() {
  const { mutate } = useTaskWrite({
    mutationFn: async ({
      id,
      task,
      preset,
      day,
    }: SnoozeRequest & { id: number }) => {
      await taskService.snooze(id, {
        preset,
        day,
        zoneName: getBrowserTimeZone() ?? "UTC",
        ...(task.isGhost && task.startAt
          ? { isGhost: true, previousStartAt: toFormattedUTCDate(task.startAt) }
          : {}),
      });
      trackEvent("task_snoozed", { preset });
    },
    apply: (queryClient, { task, preset, day }) =>
      patchTask(queryClient, {
        taskId: task.id,
        change: predictSnooze(preset, day),
      }),
    errorMessage: () => "Could not snooze the task",
  });

  return (request: SnoozeRequest) =>
    mutate({ ...request, id: taskTargetId(request.task) });
}
