import MockAdapter from "axios-mock-adapter";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import apiClient, { setSessionExpiredHandler } from "./api";

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(apiClient);
});

afterEach(() => {
  mock.restore();
  setSessionExpiredHandler(null);
});

const refreshCalls = () =>
  mock.history.post.filter((r) => r.url === "/auth/refresh").length;

describe("api client session handling", () => {
  it("does not try to refresh when the session check returns 401", async () => {
    mock.onGet("/auth/me").reply(401);
    await expect(apiClient.get("/auth/me")).rejects.toBeDefined();
    expect(refreshCalls()).toBe(0);
  });

  it("refreshes and retries a request that returned 401", async () => {
    let refreshed = false;
    mock.onPost("/auth/refresh").reply(() => {
      refreshed = true;
      return [200, {}];
    });
    mock.onGet("/tasks").reply(() => (refreshed ? [200, { ok: true }] : [401]));

    const response = await apiClient.get("/tasks");
    expect(response.data).toEqual({ ok: true });
  });

  it("shares one refresh between simultaneous 401s", async () => {
    let refreshed = false;
    mock.onPost("/auth/refresh").reply(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      refreshed = true;
      return [200, {}];
    });
    mock.onGet(/\/(tasks|stats)$/).reply(() => (refreshed ? [200, {}] : [401]));

    await Promise.all([apiClient.get("/tasks"), apiClient.get("/stats")]);
    expect(refreshCalls()).toBe(1);
  });

  it("calls the session-expired handler when the refresh fails", async () => {
    const handler = vi.fn();
    setSessionExpiredHandler(handler);
    mock.onPost("/auth/refresh").reply(401);
    mock.onGet("/tasks").reply(401);

    await expect(apiClient.get("/tasks")).rejects.toBeDefined();
    expect(handler).toHaveBeenCalled();
  });
});
