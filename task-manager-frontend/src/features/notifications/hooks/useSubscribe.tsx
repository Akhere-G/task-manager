import { useMutation } from "@tanstack/react-query";
import { notificationsService } from "../api";
import type { NotificationCreate } from "../types";

export default function useSubscribe() {
  return useMutation({
    mutationFn: async (sub: NotificationCreate) =>
      await notificationsService.subscribe(sub),
  });
}
