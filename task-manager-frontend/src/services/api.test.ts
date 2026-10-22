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

describe("session handling", () => {
  it("does not try to refresh when the session check returns 401", async () => {
    mock.onGet("/auth/me").reply(401);
    await expect(apiClient.get("/auth/me")).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(refreshCalls()).toBe(0);
  });

  it("does not refresh for a failed login", async () => {
    mock.onPost("/auth/login").reply(401);
    await expect(apiClient.post("/auth/login", {})).rejects.toBeDefined();
    expect(refreshCalls()).toBe(0);
  });

  it("refreshes once and retries a data request that returned 401", async () => {
    let refreshed = false;
    mock.onPost("/auth/refresh").reply(() => {
      refreshed = true;
      return [200, {}];
    });
    mock.onGet("/tasks").reply(() => (refreshed ? [200, { ok: true }] : [401]));

    const response = await apiClient.get("/tasks");
    expect(response.data).toEqual({ ok: true });
    expect(refreshCalls()).toBe(1);
  });

  it("reports an expired session once the refresh fails, without redirecting", async () => {
    const handler = vi.fn();
    setSessionExpiredHandler(handler);
    mock.onPost("/auth/refresh").reply(401);
    mock.onGet("/tasks").reply(401);

    await expect(apiClient.get("/tasks")).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(refreshCalls()).toBe(1);
  });

  it("gives up if the retried request still returns 401", async () => {
    mock.onPost("/auth/refresh").reply(200, {});
    mock.onGet("/tasks").reply(401);

    await expect(apiClient.get("/tasks")).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(refreshCalls()).toBe(1);
  });

  it("shares one refresh between simultaneous 401s", async () => {
    let refreshed = false;
    mock.onPost("/auth/refresh").reply(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      refreshed = true;
      return [200, {}];
    });
    mock.onGet(/\/(tasks|notifications|stats)$/).reply(() =>
      refreshed ? [200, { ok: true }] : [401],
    );

    const results = await Promise.all([
      apiClient.get("/tasks"),
      apiClient.get("/notifications"),
      apiClient.get("/stats"),
    ]);

    expect(results.map((r) => r.data)).toEqual([
      { ok: true },
      { ok: true },
      { ok: true },
    ]);
    expect(refreshCalls()).toBe(1);
  });

  it("starts a new refresh for a later expiry", async () => {
    let valid = false;
    mock.onPost("/auth/refresh").reply(() => {
      valid = true;
      return [200, {}];
    });
    mock.onGet("/tasks").reply(() => (valid ? [200, {}] : [401]));

    await apiClient.get("/tasks");
    valid = false;
    await apiClient.get("/tasks");
    expect(refreshCalls()).toBe(2);
  });

  it("rejects every waiting request when the shared refresh fails", async () => {
    const handler = vi.fn();
    setSessionExpiredHandler(handler);
    mock.onPost("/auth/refresh").reply(401);
    mock.onGet(/\/(tasks|stats)$/).reply(401);

    const results = await Promise.allSettled([
      apiClient.get("/tasks"),
      apiClient.get("/stats"),
    ]);

    expect(results.every((r) => r.status === "rejected")).toBe(true);
    expect(refreshCalls()).toBe(1);
    expect(handler).toHaveBeenCalled();
  });
});
