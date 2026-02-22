import { useQuery } from "@tanstack/react-query";
import { statsService } from "../../../services/api";

export default function useGetTimeSpent(){
  return useQuery({
    queryKey: ["timeSpent"],
    queryFn: () => statsService.getTimeSpent()
  })
}