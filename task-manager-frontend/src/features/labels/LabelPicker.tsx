import useLabels from "./hooks/useLabels";
import { MAX_LABELS_PER_TASK } from "./types";

interface LabelPickerProps {
  value: number[];
  onChange: (labelIds: number[]) => void;
}

export default function LabelPicker({ value, onChange }: LabelPickerProps) {
  const { data: labels = [] } = useLabels();

  if (labels.length === 0) {
    return (
      <p className="text-sm text-text-sub">
        No labels yet. Add some in Settings.
      </p>
    );
  }

  function toggle(id: number) {
    if (value.includes(id)) {
      onChange(value.filter((x) => x !== id));
    } else if (value.length < MAX_LABELS_PER_TASK) {
      onChange([...value, id]);
    }
  }

  return (
    <div role="group" aria-label="Labels" className="flex flex-wrap gap-2">
      {labels.map((label) => {
        const selected = value.includes(label.id);
        return (
          <button
            key={label.id}
            type="button"
            aria-pressed={selected}
            onClick={() => toggle(label.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm cursor-pointer ${
              selected
                ? "border-brand bg-brand/10 text-text-main"
                : "border-border-light text-text-sub"
            }`}
          >
            <span
              aria-hidden
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: label.colour }}
            />
            {label.name}
          </button>
        );
      })}
    </div>
  );
}
