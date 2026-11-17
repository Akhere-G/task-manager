import { useMutation, useQueryClient } from "@tanstack/react-query";

import { taskService } from "../api";
import { getBrowserTimeZone } from "../recurrence";
import { useTaskSelection } from "../selection/useTaskSelection";
import type { SnoozePreset } from "../types";

export interface BulkSnoozeRequest {
  ids: number[];
  preset: SnoozePreset;
  day?: string;
}

export default function useBulkTaskActions() {
  const queryClient = useQueryClient();
  const { clear } = useTaskSelection();

  const settings = {
    onSuccess: clear,
    onSettled: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["stats"] }),
      ]),
  };

  const complete = useMutation({
    mutationFn: taskService.bulkComplete,
    ...settings,
  });
  const remove = useMutation({
    mutationFn: taskService.bulkDelete,
    ...settings,
  });
  const snooze = useMutation({
    mutationFn: ({ ids, preset, day }: BulkSnoozeRequest) =>
      taskService.bulkSnooze(ids, {
        preset,
        day,
        zoneName: getBrowserTimeZone() ?? "UTC",
      }),
    ...settings,
  });

  return { complete, remove, snooze };
}
