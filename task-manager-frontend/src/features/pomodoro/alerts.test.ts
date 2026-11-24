import { afterEach, describe, expect, it, vi } from "vitest";
import { alertPhaseDue } from "./alerts";

vi.mock("../tasks/utils", () => ({
  playSound: () => Promise.resolve(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("alertPhaseDue", () => {
  it("notifies through the service worker when one is registered", async () => {
    const showNotification = vi.fn().mockResolvedValue(undefined);
    const NotificationMock = vi.fn();
    vi.stubGlobal(
      "Notification",
      Object.assign(NotificationMock, { permission: "granted" }),
    );
    vi.stubGlobal("navigator", {
      serviceWorker: {
        getRegistration: () => Promise.resolve({ showNotification }),
      },
    });

    await alertPhaseDue("Focus done", "Take a rest");

    expect(showNotification).toHaveBeenCalledWith(
      "Focus done",
      expect.objectContaining({ body: "Take a rest" }),
    );
    expect(NotificationMock).not.toHaveBeenCalled();
  });

  it("falls back to a page notification without a service worker", async () => {
    const NotificationMock = vi.fn();
    vi.stubGlobal(
      "Notification",
      Object.assign(NotificationMock, { permission: "granted" }),
    );
    vi.stubGlobal("navigator", {});

    await alertPhaseDue("Focus done", "Take a rest");

    expect(NotificationMock).toHaveBeenCalledWith(
      "Focus done",
      expect.objectContaining({ body: "Take a rest" }),
    );
  });
});
