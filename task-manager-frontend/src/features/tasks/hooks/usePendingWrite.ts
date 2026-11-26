import { useMutationState } from "@tanstack/react-query";

import type { Task } from "../types";

export type TaskPreview = Partial<Pick<Task, "isCompleted" | "priority">>;

export interface TaskWrite {
  id: number;
  preview?: TaskPreview | null;
}

export const taskWrite = {
  mutationKey: ["tasks", "write"],
  networkMode: "always",
} as const;

const isTaskWrite = (variables: unknown): variables is TaskWrite =>
  typeof variables === "object" && variables !== null && "id" in variables;

export default function usePendingWrite<Shown extends object>(
  id: number,
  task: Shown,
) {
  const writes = useMutationState({
    filters: { mutationKey: taskWrite.mutationKey, status: "pending" },
    select: (mutation) => mutation.state.variables,
  })
    .filter(isTaskWrite)
    .filter((write) => write.id === id);

  return {
    shown: writes.reduce<Shown>(
      (shown, { preview }) => ({ ...shown, ...preview }),
      task,
    ),
    isSaving: writes.length > 0,
    isRemoved: writes.some((write) => write.preview === null),
  };
}
