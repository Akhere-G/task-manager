import { useQuery } from "@tanstack/react-query";
import { taskService } from "../../../services/api";

export default function useGetTask(id: number) {
  return useQuery({
    queryFn: () => taskService.getById(id),
    queryKey: ["tasks", { id }],
  });
}
