import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { taskService } from "../api";

export default function useTrash(page: number) {
  return useQuery({
    queryKey: ["tasks", "trash", { page }],
    queryFn: () => taskService.getTrash(page),
    placeholderData: keepPreviousData,
  });
}
