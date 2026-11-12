import { useMutation } from "@tanstack/react-query";
import { aiService } from "../api";

export default function useSuggestPriorities() {
  return useMutation({ mutationFn: aiService.suggestPriorities });
}
