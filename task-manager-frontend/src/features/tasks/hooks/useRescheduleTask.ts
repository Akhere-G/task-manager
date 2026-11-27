import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService, type RescheduleTaskInput } from "../api";
import { toFormattedUTCDate } from "../../../utils/formators";
import { refreshTasksAndStats } from "./refreshTasksAndStats";

const formatReschedule = (data: RescheduleTaskInput): RescheduleTaskInput => ({
  ...data,
  previousStartAt: toFormattedUTCDate(data.previousStartAt),
  startAt: toFormattedUTCDate(data.startAt),
  endAt: toFormattedUTCDate(data.endAt),
});

export default function useRescheduleTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      rescheduleData,
    }: {
      id: number;
      rescheduleData: RescheduleTaskInput;
    }) => taskService.reschedule(id, formatReschedule(rescheduleData)),
    onSettled: () => refreshTasksAndStats(queryClient),
  });
}
