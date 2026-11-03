import { useMutation, useQueryClient } from "@tanstack/react-query";
import { taskService } from "../api";

export default function useDeleteSubtask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => taskService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });
}
