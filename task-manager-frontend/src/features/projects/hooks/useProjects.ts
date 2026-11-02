import { useQuery } from "@tanstack/react-query";
import { projectService } from "../api";

export default function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: projectService.getAll,
    staleTime: 60_000,
  });
}
