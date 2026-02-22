import { useQuery } from "@tanstack/react-query";
import { statsService } from "../../../services/api";

export default function useGetCategoryVolume(){
  return useQuery({
    queryKey: ["categoryVolume"],
    queryFn: () => statsService.getCategoryVolume()
  })
}