import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiTokenService } from "../api";
import type { ApiTokenInput } from "../types";

export function useCreateApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApiTokenInput) => apiTokenService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["apiTokens"] }),
  });
}

export function useDeleteApiToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiTokenService.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["apiTokens"] }),
  });
}
