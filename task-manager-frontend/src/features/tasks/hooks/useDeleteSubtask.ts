import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "../api";
import { useToast } from "../../../context/ToastContext";
import { getApiErrorMessage } from "../../../utils/errors";
import { taskWrite, type TaskWrite } from "./usePendingWrite";

export default function useDeleteSubtask() {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["tasks"] });

  const { mutate } = useMutation({
    ...taskWrite,
    mutationFn: ({ id }: TaskWrite) => taskService.delete(id),
    onSuccess: refresh,
    onError: (error) => {
      showError(getApiErrorMessage(error, "Could not delete the subtask"));
      void refresh();
    },
  });

  return (id: number) => mutate({ id, preview: null });
}
