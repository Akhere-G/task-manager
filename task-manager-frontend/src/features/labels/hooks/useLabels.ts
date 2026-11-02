import { useQuery } from "@tanstack/react-query";
import { labelService } from "../api";

export default function useLabels() {
  return useQuery({
    queryKey: ["labels"],
    queryFn: labelService.getAll,
    staleTime: 60_000,
  });
}
