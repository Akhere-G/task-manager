import { useQuery } from "@tanstack/react-query";
import { statsService } from "../../../services/api";

export default function useGetBacklogHealth(){
  return useQuery({
    queryKey: ["backlogHealth"],
    queryFn: () => statsService.getBacklogHealth()
  })
}