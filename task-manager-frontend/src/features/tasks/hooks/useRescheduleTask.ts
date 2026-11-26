import { taskService, type RescheduleTaskInput } from "../api";
import { toFormattedUTCDate } from "../../../utils/formators";
import { predictUpdate } from "../optimistic/predictions";
import { patchTask } from "../optimistic/taskCache";
import useTaskWrite from "../optimistic/useTaskWrite";

interface RescheduleRequest {
  id: number;
  occurrenceId: number;
  rescheduleData: RescheduleTaskInput;
}

const formatReschedule = (data: RescheduleTaskInput): RescheduleTaskInput => ({
  ...data,
  previousStartAt: toFormattedUTCDate(data.previousStartAt),
  startAt: toFormattedUTCDate(data.startAt),
  endAt: toFormattedUTCDate(data.endAt),
});

export default function useRescheduleTask() {
  return useTaskWrite({
    mutationFn: ({ id, rescheduleData }: RescheduleRequest) =>
      taskService.reschedule(id, formatReschedule(rescheduleData)),
    apply: (queryClient, { occurrenceId, rescheduleData }) => {
      const { startAt, endAt } = rescheduleData;
      return patchTask(queryClient, {
        taskId: occurrenceId,
        change: predictUpdate({ startAt, endAt }),
      });
    },
  });
}
