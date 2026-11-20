export type TokenScope = "read" | "write";

export interface ApiToken {
  id: number;
  name: string;
  scope: TokenScope;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface CreatedApiToken extends ApiToken {
  token: string;
}

export type ApiTokenInput = Pick<ApiToken, "name" | "scope">;

export const SCOPE_OPTIONS = [
  { name: "Read and write", value: "write" },
  { name: "Read only", value: "read" },
] as const satisfies readonly { name: string; value: TokenScope }[];
