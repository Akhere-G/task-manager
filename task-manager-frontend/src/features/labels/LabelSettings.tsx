import { useState } from "react";
import axios from "axios";
import { Pencil, Trash2 } from "lucide-react";
import FormInput from "../../components/ui/FormInput";
import { trackEvent } from "../../services/analytics";
import {
  useCreateLabel,
  useDeleteLabel,
  useUpdateLabel,
} from "./hooks/useLabelMutations";
import useLabels from "./hooks/useLabels";
import { DEFAULT_LABEL_COLOUR, type Label } from "./types";

interface Draft {
  name: string;
  colour: string;
}

const emptyDraft: Draft = { name: "", colour: DEFAULT_LABEL_COLOUR };

function errorText(err: unknown) {
  if (axios.isAxiosError(err)) {
    const errors = err.response?.data?.errors;
    if (errors) return String(Object.values(errors)[0]);
    return err.response?.data?.error ?? "Could not save the label.";
  }
  return "Could not save the label.";
}

interface LabelEditorProps {
  editing: Label | null;
  onDone: () => void;
}

function LabelEditor({ editing, onDone }: LabelEditorProps) {
  const [draft, setDraft] = useState<Draft>(
    editing ? { name: editing.name, colour: editing.colour } : emptyDraft,
  );
  const [error, setError] = useState("");
  const { mutateAsync: create } = useCreateLabel();
  const { mutateAsync: update } = useUpdateLabel();

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => setDraft((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = { name: draft.name.trim(), colour: draft.colour };
    try {
      if (editing) {
        await update({ id: editing.id, input });
      } else {
        await create(input);
        trackEvent("label_created");
      }
      setError("");
      setDraft(emptyDraft);
      onDone();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
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
          label="Label name"
          name="name"
          id={`label-name-${editing?.id ?? "new"}`}
          value={draft.name}
          handleChange={handleChange}
          formClassNames="grow"
        />
        <label className="flex flex-col text-sm font-bold text-text-main gap-2">
          Colour
          <input
            aria-label="Label colour"
            type="color"
            name="colour"
            value={draft.colour}
            onChange={handleChange}
            className="h-12 w-14 rounded-xl border border-border-light bg-bg-secondary"
          />
        </label>
      </div>
      <div className="flex gap-3 justify-end">
        {editing && (
          <button type="button" className="btn-secondary" onClick={onDone}>
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="btn-primary"
          disabled={!draft.name.trim()}
        >
          {editing ? "Save label" : "Add label"}
        </button>
      </div>
    </form>
  );
}

export default function LabelSettings() {
  const { data: labels = [] } = useLabels();
  const { mutate: remove } = useDeleteLabel();
  const [editingId, setEditingId] = useState<number | null>(null);

  function handleDelete(label: Label) {
    const ok = window.confirm(
      `Delete "${label.name}"? It is removed from every task that uses it.`,
    );
    if (ok) remove(label.id);
  }

  return (
    <div className="flex flex-col gap-4">
      {labels.length === 0 ? (
        <p className="text-text-sub">
          You have no labels yet. Labels tag tasks across projects.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {labels.map((label) => (
            <li key={label.id}>
              {editingId === label.id ? (
                <LabelEditor
                  editing={label}
                  onDone={() => setEditingId(null)}
                />
              ) : (
                <div className="flex items-center gap-3 justify-between">
                  <span className="flex items-center gap-2 text-text-main">
                    <span
                      aria-hidden
                      className="inline-block w-3 h-3 rounded-full"
                      style={{ backgroundColor: label.colour }}
                    />
                    {label.name}
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      aria-label={`Edit ${label.name}`}
                      className="p-1 text-text-sub hover:text-brand cursor-pointer"
                      onClick={() => setEditingId(label.id)}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete ${label.name}`}
                      className="p-1 text-text-sub hover:text-failure cursor-pointer"
                      onClick={() => handleDelete(label)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <LabelEditor editing={null} onDone={() => {}} />
    </div>
  );
}
