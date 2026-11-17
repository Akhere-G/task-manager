interface ButtonGroupOption {
  name: string;
  value: string;
}

interface ButtonGroupProps {
  label: string;
  value: string;
  options: ButtonGroupOption[];
  onChange: (value: string) => void;
}

const optionClass =
  "cursor-pointer px-3 py-1.5 text-sm transition-colors first:rounded-l-lg last:rounded-r-lg";

export default function ButtonGroup({
  label,
  value,
  options,
  onChange,
}: ButtonGroupProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-text-sub">
        {label}
      </span>
      <div
        role="group"
        aria-label={label}
        className="inline-flex w-fit max-w-full flex-wrap divide-x divide-surface-muted rounded-lg border"
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`${optionClass} ${value === option.value ? "bg-brand text-white" : "bg-surface text-text-main hover:bg-brand/10"}`}
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  );
}
