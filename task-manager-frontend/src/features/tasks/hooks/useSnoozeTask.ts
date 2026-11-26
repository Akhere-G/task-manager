import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "../api";
import { getBrowserTimeZone } from "../recurrence";
import type { SnoozePreset, Task } from "../types";
import { useToast } from "../../../context/ToastContext";
import { getApiErrorMessage } from "../../../utils/errors";
import { toFormattedUTCDate } from "../../../utils/formators";
import { trackEvent } from "../../../services/analytics";
import { taskTargetId } from "../utils";
import { taskWrite, type TaskWrite } from "./usePendingWrite";

export interface SnoozeRequest {
  task: Task;
  preset: SnoozePreset;
  day?: string;
}

export default function useSnoozeTask(props?: { onSnooze?: () => void }) {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const refresh = () =>
    Promise.all(
      ["tasks", "stats"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] }),
      ),
    );

  const { mutate } = useMutation({
    ...taskWrite,
    mutationFn: ({ id, task, preset, day }: TaskWrite & SnoozeRequest) =>
      taskService.snooze(id, {
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
      return refresh();
    },
    onError: (error) => {
      showError(getApiErrorMessage(error, "Could not snooze the task"));
      void refresh();
    },
  });

  return {
    mutate: (request: SnoozeRequest) =>
      mutate({ ...request, id: taskTargetId(request.task) }),
  };
}
