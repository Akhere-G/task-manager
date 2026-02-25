import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { statsService, type StatsResult } from "../../../services/api";

export default function useGetStats<TData = StatsResult>(
  select?: (data: StatsResult) => TData,
) {
  return useQuery({
    queryKey: ["stats"],
    queryFn: () => statsService.getStats(),
    placeholderData: keepPreviousData,
    staleTime: 1000 * 60 * 5,
    select: select,
  });
}
