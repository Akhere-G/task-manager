import { skipToken, useQuery } from "@tanstack/react-query";
import { columnService } from "../api";

export const columnsKey = (projectId: number | null) =>
  ["columns", projectId] as const;

export default function useColumns(projectId: number | null) {
  return useQuery({
    queryKey: columnsKey(projectId),
    queryFn:
      projectId === null ? skipToken : () => columnService.getAll(projectId),
    staleTime: 60_000,
  });
}
