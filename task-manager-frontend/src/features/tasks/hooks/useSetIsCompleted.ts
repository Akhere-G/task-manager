import useUpdateTask from "./useUpdateTask";

export default function useSetIsCompleted() {
  const { mutateAsync: updateTask } = useUpdateTask();

  async function setIsCompleted(id: number, isCompleted: boolean) {
    const completedAt = isCompleted ? new Date().toUTCString() : null;

    try {
      await updateTask({ id, newTaskData: { isCompleted, completedAt } });
    } catch (err) {
      console.error(err);
    }
  }

  return setIsCompleted;
}
