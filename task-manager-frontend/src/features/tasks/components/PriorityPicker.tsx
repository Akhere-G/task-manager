import { priorityOptions } from "../constants";

const dotColours: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-orange-500",
  3: "bg-blue-500",
  4: "bg-slate-400",
};

interface PriorityPickerProps {
  value: number;
  onChange: (priority: number) => void;
  error?: string;
}

export default function PriorityPicker({
  value,
  onChange,
  error,
}: PriorityPickerProps) {
  return (
    <fieldset className="flex flex-col">
      <legend className="mb-2 text-sm font-bold text-text-main">
        Priority
      </legend>
      <div className="grid grid-cols-4 gap-1 rounded-xl border border-border-light bg-surface-muted p-1">
        {priorityOptions.map(({ name, value: optionValue }) => {
          const priority = Number(optionValue);
          const selected = value === priority;
          return (
            <button
              key={optionValue}
              type="button"
              aria-pressed={selected}
              aria-label={`Priority ${name.replace(" · ", ", ")}`}
              onClick={() => onChange(priority)}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg p-2 text-sm transition-colors ${
                selected
                  ? "bg-surface font-bold text-text-main shadow-sm"
                  : "text-text-sub hover:text-text-main"
              }`}
            >
              <span
                aria-hidden="true"
                className={`h-2 w-2 rounded-full ${dotColours[priority]}`}
              />
              P{priority}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-failure">{error}</p>}
    </fieldset>
  );
}
