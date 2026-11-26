import {
  useMutation,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { useToast } from "../../../context/ToastContext";
import { getApiErrorMessage } from "../../../utils/errors";
import type { CachePatch } from "./taskCache";

export const TASK_WRITE_KEY = ["tasks", "write"] as const;

const STALE_AFTER_WRITE = ["tasks", "stats", "projects", "labels"];

interface TaskWrite<Variables, Result> {
  mutationFn: (variables: Variables) => Promise<Result>;
  apply: (queryClient: QueryClient, variables: Variables) => CachePatch;
  errorMessage?: (variables: Variables) => string | null;
}

export default function useTaskWrite<Variables extends { id: number }, Result>({
  mutationFn,
  apply,
  errorMessage,
}: TaskWrite<Variables, Result>) {
  const queryClient = useQueryClient();
  const { showError } = useToast();

  return useMutation({
    mutationKey: TASK_WRITE_KEY,
    networkMode: "always",
    mutationFn,
    onMutate: (variables: Variables) => {
      const patch = apply(queryClient, variables);
      patch.queryKeys.forEach((queryKey) => {
        void queryClient.cancelQueries({ queryKey, exact: true });
      });
      return patch;
    },
    onError: (error, variables, patch) => {
      patch?.undo();
      const fallback = errorMessage?.(variables);
      if (fallback) showError(getApiErrorMessage(error, fallback));
    },
    onSettled: () => {
      if (queryClient.isMutating({ mutationKey: TASK_WRITE_KEY }) > 1) return;
      return Promise.all(
        STALE_AFTER_WRITE.map((key) =>
          queryClient.invalidateQueries({ queryKey: [key] }),
        ),
      );
    },
  });
}
