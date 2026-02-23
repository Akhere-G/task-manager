import { useQuery } from "@tanstack/react-query";
import { statsService } from "../../../services/api";

export default function useGetOverdueDistribution(){
  return useQuery({
    queryKey: ["overdueDistribution"],
    queryFn: () => statsService.getOverdueDistribution()
  })
}