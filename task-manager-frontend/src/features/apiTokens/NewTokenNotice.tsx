import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  AUTHORIZATION_HEADER,
  bearerValue,
  connectCommand,
  mcpUrl,
} from "./connectCommand";
import type { CreatedApiToken } from "./types";

interface NewTokenNoticeProps {
  created: CreatedApiToken;
  onDismiss: () => void;
}

export function NewTokenNotice({ created, onDismiss }: NewTokenNoticeProps) {
  const [copied, setCopied] = useState(false);
  const command = connectCommand(created.token);

  async function handleCopy() {
    await navigator.clipboard.writeText(command);
    setCopied(true);
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-brand/40 bg-brand/10 p-4"
    >
      <p className="text-text-main">
        <strong>{created.name}</strong> is ready. Run this in your terminal to
        connect Claude Code. The token is shown only once.
      </p>
      <pre className="overflow-x-auto rounded-lg bg-bg-secondary p-3 text-sm text-text-main">
        <code>{command}</code>
      </pre>
      <div className="text-sm text-text-main">
        <p className="font-semibold">Claude on the web</p>
        <p className="text-text-sub">
          In Claude, add a custom connector with this URL, choose &ldquo;No sign in&rdquo;
          and add this request header. It only works when this site is on the
          public internet.
        </p>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt>URL</dt>
          <dd className="break-all">
            <code>{mcpUrl()}</code>
          </dd>
          <dt>Header name</dt>
          <dd>
            <code>{AUTHORIZATION_HEADER}</code>
          </dd>
          <dt>Header value</dt>
          <dd className="break-all">
            <code>{bearerValue(created.token)}</code>
          </dd>
        </dl>
      </div>
      <div className="flex gap-3 justify-end">
        <button type="button" className="btn-secondary" onClick={handleCopy}>
          {copied ? (
            <Check className="w-4 h-4 inline mr-1" />
          ) : (
            <Copy className="w-4 h-4 inline mr-1" />
          )}
          {copied ? "Copied" : "Copy command"}
        </button>
        <button type="button" className="btn-primary" onClick={onDismiss}>
          Done
        </button>
      </div>
    </div>
  );
}
