import { useQuery } from "@tanstack/react-query";
import { taskService } from "../api";

export default function useGetTask(id: number, enabled = true) {
  return useQuery({
    enabled,
    queryFn: () => taskService.getById(id),
    queryKey: ["tasks", { id }],
  });
}
