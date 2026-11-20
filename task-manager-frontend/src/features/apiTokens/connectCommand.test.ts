import { afterEach, describe, expect, it } from "vitest";
import apiClient from "../../services/api";
import { connectCommand, mcpUrl } from "./connectCommand";

const originalBaseUrl = apiClient.defaults.baseURL;

afterEach(() => {
  apiClient.defaults.baseURL = originalBaseUrl;
});

describe("mcpUrl", () => {
  it("is the origin of an absolute api url plus /mcp", () => {
    apiClient.defaults.baseURL = "https://tasks.example.com/api";
    expect(mcpUrl()).toBe("https://tasks.example.com/mcp");
  });

  it("uses the current origin for a relative api url", () => {
    apiClient.defaults.baseURL = "/api";
    expect(mcpUrl()).toBe(`${window.location.origin}/mcp`);
  });
});

describe("connectCommand", () => {
  it("passes the token as a bearer header", () => {
    apiClient.defaults.baseURL = "https://tasks.example.com/api";
    expect(connectCommand("tm_abc")).toBe(
      'claude mcp add --transport http taskflow https://tasks.example.com/mcp --header "Authorization: Bearer tm_abc"',
    );
  });
});
