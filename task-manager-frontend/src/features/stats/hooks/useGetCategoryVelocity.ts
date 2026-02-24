import { useQuery } from "@tanstack/react-query";
import { statsService } from "../../../services/api";

export default function useGetCategoryVelocity(){
  return useQuery({
    queryKey: ["categoryVelocity"],
    queryFn: () => statsService.getCategoryVelocity()
  })
}