import apiClient from "../../services/api";

export function mcpUrl(): string {
  const apiBase = new URL(
    apiClient.defaults.baseURL ?? "/api",
    window.location.origin,
  );
  return new URL("/mcp", apiBase).href;
}

export function connectCommand(token: string): string {
  return `claude mcp add --transport http taskflow ${mcpUrl()} --header "Authorization: Bearer ${token}"`;
}
