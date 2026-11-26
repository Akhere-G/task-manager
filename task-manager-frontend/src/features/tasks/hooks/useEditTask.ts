import { useTaskContext } from "../../../context/TaskContext";
import type { CreateTaskInput, TaskUpdate } from "../types";
import { formErrorsFrom } from "../formErrors";
import useUpdateTask from "./useUpdateTask";
import { trackEvent } from "../../../services/analytics";

export default function useEditTask() {
  const { mutateAsync: updateTask } = useUpdateTask();
  const { selectedTask, closePopup, reopenEdit } = useTaskContext();
  async function handleEdit(newTask: CreateTaskInput) {
    if (!selectedTask) return;
    const rawData = {
      ...newTask,
      title: newTask.title.trim(),
      description: newTask.description?.trim() || null,
      projectId: newTask.projectId,
      startAt: newTask.startAt,
      endAt: newTask.endAt,
    };

    const patchData: TaskUpdate = Object.fromEntries(
      // The form has no column field; the loaded one would clash with a project change.
      Object.entries(rawData).filter(
        ([key, value]) => value !== "" && key !== "columnId",
      ),
    );

    closePopup();
    try {
      await updateTask({ id: selectedTask.id, newTaskData: patchData });
      trackEvent("task_updated", {
        has_project: newTask.projectId !== null,
        is_repeating: Boolean(newTask.repeatBy),
        repeat_by: newTask.repeatBy ?? null,
        repeat_interval: newTask.repeatInterval ?? 1,
      });
    } catch (err) {
      console.error("Update failed:", err);
      reopenEdit({ ...selectedTask, ...patchData }, formErrorsFrom(err));
    }
  }

  return handleEdit;
}
