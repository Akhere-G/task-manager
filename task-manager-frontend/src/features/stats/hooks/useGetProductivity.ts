import { useQuery } from "@tanstack/react-query";
import { statsService } from "../../../services/api";

export default function useGetProductivity(days=365){
  return useQuery({
    queryKey: ["productivity", { days }],
    queryFn: () => statsService.getProductivity(days)
  })
}