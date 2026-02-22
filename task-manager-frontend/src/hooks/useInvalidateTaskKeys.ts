import { useQueryClient } from "@tanstack/react-query";
import { statsQueryKeys } from "../features/stats/constants";

export default function useInvalidateTaskKeys(){
  const queryClient = useQueryClient()

  const keys = ["tasks", ...statsQueryKeys]
  const invalidateKeys = () => keys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }))

  return invalidateKeys

}