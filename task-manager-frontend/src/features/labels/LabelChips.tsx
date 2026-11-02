import useLabels from "./hooks/useLabels";

interface LabelChipsProps {
  labelIds: number[] | undefined;
  className?: string;
}

export default function LabelChips({
  labelIds,
  className = "",
}: LabelChipsProps) {
  const { data: labels = [] } = useLabels();
  const chosen = labels.filter((label) => labelIds?.includes(label.id));
  if (chosen.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-1 ${className}`} aria-label="Labels">
      {chosen.map((label) => (
        <li
          key={label.id}
          className="inline-flex items-center gap-1 rounded-full border border-border-light px-2 text-[10px] font-semibold text-text-sub"
        >
          <span
            aria-hidden
            className="inline-block w-2 h-2 rounded-full"
            style={{ backgroundColor: label.colour }}
          />
          {label.name}
        </li>
      ))}
    </ul>
  );
}
