import { useTaskContext } from "../../../context/TaskContext";
import type { CreateTaskInput, Task } from "../types";
import useUpdateTask from "./useUpdateTask";
import { trackEvent } from "../../../services/analytics";

export default function useEditTask(props?: { onSuccess?: () => void }) {
  const { onSuccess } = props ?? {};
  const { mutateAsync: updateTask } = useUpdateTask();
  const { selectedTask } = useTaskContext();
  async function handleEdit(newTask: CreateTaskInput) {
    if (!selectedTask) return;
    const rawData = {
      ...newTask,
      title: newTask.title.trim(),
      description: newTask.description?.trim() || null,
      category: newTask.category,
      startAt: newTask.startAt,
      endAt: newTask.endAt,
    };

    const patchData: Partial<Task> = Object.fromEntries(
      Object.entries(rawData).filter(([, value]) => value !== ""),
    );

    try {
      await updateTask({ id: selectedTask.id, newTaskData: patchData });
      trackEvent("task_updated", {
        category: newTask.category,
        is_repeating: Boolean(newTask.repeatBy),
        repeat_by: newTask.repeatBy ?? null,
      });
      onSuccess?.();
    } catch (err) {
      console.error("Update failed:", err);
      throw err;
    }
  }

  return handleEdit;
}
