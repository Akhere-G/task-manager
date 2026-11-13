import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useUpdateColumn } from "../hooks/useColumnMutations";
import {
  ON_DROP_OPTIONS,
  isOnDrop,
  type ColumnInput,
  type ProjectColumn,
} from "../types";

interface ColumnSettingsProps {
  column: ProjectColumn;
  onDelete: () => void;
  canDelete: boolean;
}

const fieldClass =
  "rounded-lg border border-slate-300 bg-canvas px-2 py-1 text-sm text-text-main dark:border-slate-700";

export default function ColumnSettings({
  column,
  onDelete,
  canDelete,
}: ColumnSettingsProps) {
  const { mutate: updateColumn } = useUpdateColumn(column.projectId);
  const [name, setName] = useState(column.name);
  const [status, setStatus] = useState(column.status);
  const [colour, setColour] = useState(column.colour);

  const save = (input: Partial<ColumnInput>) =>
    updateColumn({ id: column.id, input });
  const saveName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== column.name) save({ name: trimmed });
  };
  const saveStatus = () => {
    const trimmed = status.trim();
    if (trimmed && trimmed !== column.status) save({ status: trimmed });
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface-muted p-2 text-sm">
      <label className="flex flex-col gap-1 text-text-sub">
        Name
        <input
          className={fieldClass}
          value={name}
          maxLength={50}
          onChange={(event) => setName(event.target.value)}
          onBlur={saveName}
        />
      </label>
      <label className="flex flex-col gap-1 text-text-sub">
        Status
        <input
          className={fieldClass}
          value={status}
          maxLength={50}
          onChange={(event) => setStatus(event.target.value)}
          onBlur={saveStatus}
        />
      </label>
      <label className="flex flex-col gap-1 text-text-sub">
        Colour
        <input
          type="color"
          value={colour}
          onChange={(event) => setColour(event.target.value)}
          onBlur={() => colour !== column.colour && save({ colour })}
          className="h-8 w-full cursor-pointer"
        />
      </label>
      <label className="flex flex-col gap-1 text-text-sub">
        When a task is dropped here
        <select
          className={fieldClass}
          value={column.onDrop}
          onChange={(event) => {
            const { value } = event.target;
            if (isOnDrop(value)) save({ onDrop: value });
          }}
        >
          {ON_DROP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        onClick={onDelete}
        disabled={!canDelete}
        title={canDelete ? undefined : "A project needs at least one column"}
        className="flex items-center gap-1 self-start text-failure disabled:opacity-40"
      >
        <Trash2 size={14} aria-hidden />
        Delete column
      </button>
    </div>
  );
}
