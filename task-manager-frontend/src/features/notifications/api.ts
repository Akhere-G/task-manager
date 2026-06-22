import apiClient from "../../services/api";
import type { NotificationCreate } from "./types";

export const notificationsService = {
  subscribe: async function (sub: NotificationCreate) {
    await apiClient.post("/notifications/subscribe", sub);
  },
};
