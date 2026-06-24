import type { Task } from "../types";
import { skipDate } from "../utils";
import useUpdateTask from "./useUpdateTask";

export default function useSkipTask() {
  const { mutateAsync: updateTask } = useUpdateTask();
  async function skipTask(task: Task) {
    try {
      if (!task.repeatBy) return;

      const startAt = new Date(task.startAt);
      const endAt = new Date(task.endAt);

      const newStartAt = skipDate(startAt, task.repeatBy);
      const newEndAt = skipDate(endAt, task.repeatBy);

      await updateTask({
        id: task.id,
        newTaskData: {
          startAt: newStartAt.toISOString(),
          endAt: newEndAt.toISOString(),
        },
      });
    } catch (err) {
      console.error(err);
    }
  }

  return skipTask;
}
