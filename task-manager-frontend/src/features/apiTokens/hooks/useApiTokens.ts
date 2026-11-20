import { useQuery } from "@tanstack/react-query";
import { apiTokenService } from "../api";

export function useApiTokens() {
  return useQuery({
    queryKey: ["apiTokens"],
    queryFn: apiTokenService.getAll,
  });
}
