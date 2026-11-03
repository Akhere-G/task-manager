import { useQuery } from "@tanstack/react-query";
import { taskService } from "../api";
import { getBrowserTimeZone } from "../recurrence";

export default function useTaskCounts() {
  const zone = getBrowserTimeZone() ?? "UTC";
  return useQuery({
    queryKey: ["tasks", "counts", zone],
    queryFn: () => taskService.getCounts(zone),
    staleTime: 60_000,
  });
}
