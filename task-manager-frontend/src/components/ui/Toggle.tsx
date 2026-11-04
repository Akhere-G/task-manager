interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export default function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-text-main"
    >
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-brand" : "bg-disabled-bg"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-surface shadow-sm transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </span>
      <span aria-hidden="true" className="hidden sm:inline">
        {label}
      </span>
    </button>
  );
}
