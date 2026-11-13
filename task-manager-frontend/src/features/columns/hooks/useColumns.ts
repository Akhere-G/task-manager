import { useQuery } from "@tanstack/react-query";
import { columnService } from "../api";

export const columnsKey = (projectId: number | null) =>
  ["columns", projectId] as const;

export default function useColumns(projectId: number | null) {
  return useQuery({
    queryKey: columnsKey(projectId),
    queryFn: () => columnService.getAll(projectId as number),
    enabled: projectId !== null,
    staleTime: 60_000,
  });
}
