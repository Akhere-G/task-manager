import { useMutationState } from "@tanstack/react-query";

import { isRecord } from "./listQueries";
import { TASK_WRITE_KEY } from "./useTaskWrite";

export default function useSavingTaskIds(): ReadonlySet<number> {
  const ids = useMutationState({
    filters: { mutationKey: TASK_WRITE_KEY, status: "pending" },
    select: ({ state: { variables } }) =>
      isRecord(variables) ? variables.id : undefined,
  });
  return new Set(ids.filter((id) => typeof id === "number"));
}
