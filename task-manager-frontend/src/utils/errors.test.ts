import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { getApiErrorMessage, getRateLimitMessage } from "./errors";

const axiosError = (
  status: number,
  headers: Record<string, string> = {},
  data: unknown = {},
) =>
  new AxiosError("failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    statusText: "",
    data,
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

describe("getApiErrorMessage", () => {
  it("prefers the first field error", () => {
    const err = axiosError(400, {}, { errors: { name: "Name is required." } });
    expect(getApiErrorMessage(err, "Could not save.")).toBe(
      "Name is required.",
    );
  });

  it("falls back to the error message, then to the fallback", () => {
    expect(
      getApiErrorMessage(axiosError(404, {}, { error: "Not found." }), "Nope"),
    ).toBe("Not found.");
    expect(getApiErrorMessage(axiosError(500), "Nope")).toBe("Nope");
    expect(getApiErrorMessage(new Error("boom"), "Nope")).toBe("Nope");
  });
});
