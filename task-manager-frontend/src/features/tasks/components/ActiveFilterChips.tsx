import { X } from "lucide-react";
import type { ActiveFilter } from "../activeFilters";

interface ActiveFilterChipsProps {
  filters: ActiveFilter[];
  onClear: (filter: ActiveFilter) => void;
}

export default function ActiveFilterChips({
  filters,
  onClear,
}: ActiveFilterChipsProps) {
  return (
    <ul className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => (
        <li
          key={filter.name}
          className="flex items-center gap-1.5 rounded-lg border bg-surface py-1 pl-2.5 pr-1.5 text-xs text-text-sub"
        >
          {filter.title}:
          <strong className="font-semibold text-text-main">
            {filter.valueName}
          </strong>
          <button
            type="button"
            aria-label={`Clear ${filter.title} filter`}
            onClick={() => onClear(filter)}
            className="cursor-pointer rounded p-0.5 hover:bg-surface-muted"
          >
            <X aria-hidden size={13} />
          </button>
        </li>
      ))}
    </ul>
  );
}
