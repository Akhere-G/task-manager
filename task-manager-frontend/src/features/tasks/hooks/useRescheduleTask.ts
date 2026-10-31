import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService, type RescheduleTaskInput } from "../api";
import { toFormattedUTCDate } from "../../../utils/formators";

const formatReschedule = (data: RescheduleTaskInput): RescheduleTaskInput => ({
  ...data,
  previousStartAt: toFormattedUTCDate(data.previousStartAt),
  previousEndAt: toFormattedUTCDate(data.previousEndAt),
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });
}
