import apiClient from "../../services/api";

export function mcpUrl(): string {
  const apiBase = new URL(
    apiClient.defaults.baseURL ?? "/api",
    window.location.origin,
  );
  return new URL("/mcp", apiBase).href;
}

export const AUTHORIZATION_HEADER = "Authorization";

export function bearerValue(token: string): string {
  return `Bearer ${token}`;
}

export function connectCommand(token: string): string {
  return `claude mcp add --transport http taskflow ${mcpUrl()} --header "${AUTHORIZATION_HEADER}: ${bearerValue(token)}"`;
}
