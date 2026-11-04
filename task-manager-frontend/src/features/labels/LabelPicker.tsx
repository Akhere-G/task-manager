import { Tag } from "lucide-react";
import { useState } from "react";
import useLabels from "./hooks/useLabels";
import { MAX_LABELS_PER_TASK } from "./types";

const MAX_LABEL_NAME_LENGTH = 50;

interface LabelPickerProps {
  value: number[];
  onChange: (labelIds: number[]) => void;
  /** Names of labels that don't exist yet; created when the task is saved. */
  newNames?: string[];
  /** Passing this lets the user type new labels. */
  onNewNamesChange?: (names: string[]) => void;
}

const chipClass = (selected: boolean) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm cursor-pointer ${
    selected
      ? "border-brand bg-brand/10 text-text-main"
      : "border-border-light text-text-sub"
  }`;

export default function LabelPicker({
  value,
  onChange,
  newNames = [],
  onNewNamesChange,
}: LabelPickerProps) {
  const { data: labels = [] } = useLabels();
  const [draft, setDraft] = useState("");
  const total = value.length + newNames.length;
  const atLimit = total >= MAX_LABELS_PER_TASK;

  function toggle(id: number) {
    if (value.includes(id)) {
      onChange(value.filter((x) => x !== id));
    } else if (!atLimit) {
      onChange([...value, id]);
    }
  }

  function addDraft() {
    const name = draft.trim();
    if (!name || name.length > MAX_LABEL_NAME_LENGTH || !onNewNamesChange) {
      return;
    }
    setDraft("");
    const lower = name.toLowerCase();
    const existing = labels.find((l) => l.name.toLowerCase() === lower);
    if (existing) {
      if (!value.includes(existing.id)) toggle(existing.id);
    } else if (!atLimit && !newNames.some((n) => n.toLowerCase() === lower)) {
      onNewNamesChange([...newNames, name]);
    }
  }

  const empty = labels.length === 0 && newNames.length === 0;

  return (
    <div className="flex flex-col gap-2">
      {onNewNamesChange && (
        <div className="flex gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-border-light bg-bg-secondary px-3 focus-within:border-brand">
            <Tag
              size={16}
              aria-hidden="true"
              className="shrink-0 text-text-sub"
            />
            <input
              aria-label="New label"
              placeholder="Type a label and press Enter"
              maxLength={MAX_LABEL_NAME_LENGTH}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addDraft();
                }
              }}
              className="w-full bg-transparent py-3 text-text-main outline-none placeholder:text-text-sub/50"
            />
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={addDraft}
            disabled={!draft.trim() || atLimit}
          >
            Add label
          </button>
        </div>
      )}
      {empty && !onNewNamesChange && (
        <p className="text-sm text-text-sub">
          No labels yet. Add some in Settings.
        </p>
      )}
      <div role="group" aria-label="Labels" className="flex flex-wrap gap-2">
        {labels.map((label) => {
          const selected = value.includes(label.id);
          return (
            <button
              key={label.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(label.id)}
              className={chipClass(selected)}
            >
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: label.colour }}
              />
              {label.name}
            </button>
          );
        })}
        {newNames.map((name) => (
          <button
            key={name}
            type="button"
            aria-pressed
            aria-label={`Remove new label: ${name}`}
            onClick={() =>
              onNewNamesChange?.(newNames.filter((n) => n !== name))
            }
            className={chipClass(true)}
          >
            {name} ×
          </button>
        ))}
      </div>
    </div>
  );
}
