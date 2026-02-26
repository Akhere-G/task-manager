import { useQuery } from "@tanstack/react-query";
import { aiService } from "../../../services/api";

export default function useGetDailyBrief() {
  return useQuery({
    queryKey: ["dailyBrief"],
    queryFn: async () => {
      const data = await aiService.getDailyBrief();
      return data.brief;
    },
    staleTime: 1000 * 60 * 60,
    retry: 1,
  });
}
