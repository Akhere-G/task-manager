import { useState } from "react";
import { Trash2 } from "lucide-react";
import FormInput from "../../components/ui/FormInput";
import { getApiErrorMessage } from "../../utils/errors";
import {
  useCreateApiToken,
  useDeleteApiToken,
} from "./hooks/useApiTokenMutations";
import { useApiTokens } from "./hooks/useApiTokens";
import { NewTokenNotice } from "./NewTokenNotice";
import {
  SCOPE_OPTIONS,
  type ApiToken,
  type CreatedApiToken,
  type TokenScope,
} from "./types";

function lastUsedText(token: ApiToken) {
  if (!token.lastUsedAt) return "Never used";
  return `Last used ${new Date(token.lastUsedAt).toLocaleDateString("en-GB")}`;
}

function isTokenScope(value: string): value is TokenScope {
  return SCOPE_OPTIONS.some((option) => option.value === value);
}

export function ApiTokenSettings() {
  const { data: tokens = [] } = useApiTokens();
  const { mutateAsync: create } = useCreateApiToken();
  const { mutate: remove } = useDeleteApiToken();
  const [name, setName] = useState("");
  const [scope, setScope] = useState<TokenScope>("write");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedApiToken | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      setCreated(await create({ name: name.trim(), scope }));
      setName("");
      setError("");
    } catch (err) {
      setError(getApiErrorMessage(err, "Could not create the token."));
    }
  }

  function handleRevoke(token: ApiToken) {
    const ok = window.confirm(
      `Revoke "${token.name}"? Anything using it stops working immediately.`,
    );
    if (ok) remove(token.id);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-text-sub">
        Let Claude read and manage your tasks, projects and labels. Create a
        token for each app that connects, and revoke it any time.
      </p>
      {created && (
        <NewTokenNotice created={created} onDismiss={() => setCreated(null)} />
      )}
      {tokens.length > 0 && (
        <ul className="flex flex-col gap-2">
          {tokens.map((token) => (
            <li
              key={token.id}
              className="flex items-center gap-3 justify-between"
            >
              <span className="flex flex-col text-text-main">
                {token.name}
                <span className="text-sm text-text-sub">
                  {token.prefix}… ·{" "}
                  {token.scope === "write" ? "Read and write" : "Read only"} ·{" "}
                  {lastUsedText(token)}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Revoke ${token.name}`}
                className="p-1 text-text-sub hover:text-failure cursor-pointer"
                onClick={() => handleRevoke(token)}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {error && (
          <p
            role="alert"
            className="text-failure bg-failure/10 p-1 pl-4 rounded-md border-l-failure border-l-4"
          >
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3 items-end">
          <FormInput
            label="Token name"
            name="name"
            id="api-token-name"
            value={name}
            handleChange={(e) => setName(e.target.value)}
            formClassNames="grow"
          />
          <FormInput
            label="Access"
            name="scope"
            id="api-token-scope"
            value={scope}
            options={[...SCOPE_OPTIONS]}
            handleChange={(e) => {
              if (isTokenScope(e.target.value)) setScope(e.target.value);
            }}
          />
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={!name.trim()}>
            Create token
          </button>
        </div>
      </form>
    </div>
  );
}
