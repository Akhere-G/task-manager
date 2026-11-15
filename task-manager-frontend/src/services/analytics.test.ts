import { beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
  capture: vi.fn(),
  identify: vi.fn(),
  init: vi.fn(),
  opt_in_capturing: vi.fn(),
  opt_out_capturing: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("posthog-js", () => ({ default: posthog }));

describe("analytics consent", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("starts without browser persistence and enables it after consent", async () => {
    const analytics = await import("./analytics");

    analytics.initAnalytics();

    expect(posthog.init).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        autocapture: false,
        cookieless_mode: "on_reject",
        disable_session_recording: false,
      }),
    );
    expect(posthog.opt_out_capturing).toHaveBeenCalledOnce();

    analytics.startAnalyticsSession({ id: "42" });
    expect(posthog.identify).not.toHaveBeenCalled();

    analytics.setAnalyticsCookieConsent(true);
    expect(posthog.opt_in_capturing).toHaveBeenCalledWith({
      captureEventName: false,
    });
    expect(posthog.identify).toHaveBeenCalledWith("42");
  });

  it("returns to cookieless tracking when consent is withdrawn", async () => {
    const analytics = await import("./analytics");
    analytics.initAnalytics();
    analytics.setAnalyticsCookieConsent(true);

    analytics.setAnalyticsCookieConsent(false);

    expect(posthog.opt_out_capturing).toHaveBeenCalledTimes(2);
  });
});
