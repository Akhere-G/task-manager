import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { getRateLimitMessage } from "./errors";

const axiosError = (status: number, headers: Record<string, string> = {}) =>
  new AxiosError("failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    data: {},
    headers: new AxiosHeaders(headers),
    config: { headers: new AxiosHeaders() },
  });

describe("getRateLimitMessage", () => {
  it("only reports rate limit errors", () => {
    expect(getRateLimitMessage(axiosError(400))).toBeNull();
  });

  it("rounds Retry-After up to whole minutes", () => {
    expect(getRateLimitMessage(axiosError(429, { "retry-after": "61" }))).toBe(
      "Too many attempts. Try again in 2 minutes.",
    );
  });
});
