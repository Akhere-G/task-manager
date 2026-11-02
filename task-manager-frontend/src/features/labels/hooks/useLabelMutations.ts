import { useMutation, useQueryClient } from "@tanstack/react-query";
import { labelService } from "../api";
import type { LabelInput } from "../types";

export function useCreateLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: LabelInput) => labelService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["labels"] }),
  });
}

export function useUpdateLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<LabelInput> }) =>
      labelService.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["labels"] }),
  });
}

export function useDeleteLabel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => labelService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["labels"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
