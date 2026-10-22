import { useEffect, useRef } from "react";
import { matchPath, useLocation } from "react-router-dom";
import { useAuthContext } from "../context/AuthContext";
import { trackEvent, type AnalyticsEvent } from "../services/analytics";

type Access = "protected" | "guest" | "public";

const pageRoutes: { path: string; event: AnalyticsEvent; access: Access }[] = [
  { path: "/", event: "view_page_home", access: "protected" },
  { path: "/addtask", event: "view_page_add_task", access: "protected" },
  { path: "/calendar", event: "view_page_calendar", access: "protected" },
  { path: "/stats", event: "view_page_stats", access: "protected" },
  {
    path: "/pomodoro/:taskId",
    event: "view_page_pomodoro",
    access: "protected",
  },
  {
    path: "/breakdown/:taskId",
    event: "view_page_task_breakdown",
    access: "protected",
  },
  { path: "/settings", event: "view_page_settings", access: "protected" },
  { path: "/about", event: "view_page_about", access: "public" },
  { path: "/contact", event: "view_page_contact", access: "public" },
  { path: "/register", event: "view_page_register", access: "guest" },
  { path: "/login", event: "view_page_login", access: "guest" },
  { path: "/demo", event: "view_page_demo", access: "guest" },
  {
    path: "/login/request-password-reset",
    event: "view_page_request_password_reset",
    access: "guest",
  },
  {
    path: "/reset-password",
    event: "view_page_reset_password",
    access: "guest",
  },
];

export default function usePageViewTracking() {
  const { pathname } = useLocation();
  const { isAuthenticated, isLoading } = useAuthContext();
  const lastTrackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (isLoading || lastTrackedPath.current === pathname) return;

    const route = pageRoutes.find(({ path }) =>
      matchPath({ path, end: true }, pathname),
    );
    const access = route?.access ?? "public";
    const willRedirect =
      (access === "protected" && !isAuthenticated) ||
      (access === "guest" && isAuthenticated);
    if (willRedirect) return;

    lastTrackedPath.current = pathname;
    trackEvent(route?.event ?? "view_page_not_found");
  }, [pathname, isAuthenticated, isLoading]);
}
