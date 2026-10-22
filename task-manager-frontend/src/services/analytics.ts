import posthog from "posthog-js";
import axios from "axios";

export type AnalyticsEvent =
  | "view_page_home"
  | "view_page_add_task"
  | "view_page_calendar"
  | "view_page_stats"
  | "view_page_pomodoro"
  | "view_page_task_breakdown"
  | "view_page_settings"
  | "view_page_about"
  | "view_page_contact"
  | "view_page_register"
  | "view_page_login"
  | "view_page_demo"
  | "view_page_request_password_reset"
  | "view_page_reset_password"
  | "view_page_not_found"
  | "register"
  | "register_failed"
  | "login"
  | "login_failed"
  | "demo_started"
  | "logout"
  | "demo_exited"
  | "password_reset_requested"
  | "session_expired"
  | "task_created"
  | "task_updated"
  | "task_completed"
  | "task_status_changed"
  | "task_deleted"
  | "recurring_task_skipped"
  | "calendar_task_rescheduled"
  | "task_form_validation_failed"
  | "tasks_filtered"
  | "tasks_searched"
  | "tasks_imported_csv"
  | "tasks_exported_csv"
  | "pomodoro_started"
  | "pomodoro_completed"
  | "notifications_prompt_responded"
  | "ai_task_parse_requested"
  | "ai_task_parse_succeeded"
  | "ai_task_parse_failed"
  | "ai_task_breakdown_requested"
  | "ai_task_breakdown_succeeded"
  | "ai_task_breakdown_failed"
  | "ai_task_breakdown_applied"
  | "ai_daily_brief_viewed";

type AnalyticsValue = string | number | boolean | string[] | null | undefined;
export type AnalyticsProps = Record<string, AnalyticsValue>;

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST =
  import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

let isEnabled = false;
let identifiedId: string | null = null;
let isDemo = false;
let hasSession = false;

export function initAnalytics() {
  if (!POSTHOG_KEY || isEnabled) return;
  try {
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      persistence: "memory",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      person_profiles: "identified_only",
      respect_dnt: true,
    });
    isEnabled = true;
  } catch (err) {
    console.error("Analytics init failed", err);
  }
}

export function trackEvent(
  event: AnalyticsEvent,
  props?: AnalyticsProps,
  options?: { beacon?: boolean },
) {
  if (!isEnabled) return;
  try {
    posthog.capture(
      event,
      { ...props, is_demo: isDemo },
      options?.beacon ? { transport: "sendBeacon" } : undefined,
    );
  } catch (err) {
    console.error("Analytics capture failed", err);
  }
}

export function startAnalyticsSession(user: { id: string; isDemo?: boolean }) {
  hasSession = true;
  isDemo = Boolean(user.isDemo);
  if (!isEnabled || isDemo) return;
  try {
    const id = String(user.id);
    if (identifiedId === id) return;
    if (identifiedId) posthog.reset();
    posthog.identify(id);
    identifiedId = id;
  } catch (err) {
    console.error("Analytics identify failed", err);
  }
}

export function endAnalyticsSession() {
  hasSession = false;
  isDemo = false;
  identifiedId = null;
  if (!isEnabled) return;
  try {
    posthog.reset();
  } catch (err) {
    console.error("Analytics reset failed", err);
  }
}

export const hasAnalyticsSession = () => hasSession;

export function getErrorType(err: unknown) {
  if (!axios.isAxiosError(err)) return "unknown";
  return err.response ? `http_${err.response.status}` : "network_error";
}
