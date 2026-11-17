import {
  ChevronDown,
  ChevronUp,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import useLabels from "../../labels/hooks/useLabels";
import { findActiveFilters } from "../activeFilters";
import type { TaskFilters } from "../taskParams";
import ActiveFilterChips from "./ActiveFilterChips";

interface FilterToolbarProps {
  filters: TaskFilters;
  updateFilters: (name: string, value: string) => void;
  resetFilters: () => void;
  canFilterCompleted: boolean;
  isOpen: boolean;
  onToggle: () => void;
}

export default function FilterToolbar({
  filters,
  updateFilters,
  resetFilters,
  canFilterCompleted,
  isOpen,
  onToggle,
}: FilterToolbarProps) {
  const { data: labels = [] } = useLabels();
  const activeFilters = findActiveFilters(filters, labels, canFilterCompleted);
  const ToggleIcon = isOpen ? ChevronUp : ChevronDown;
  const hasAnythingToClear = activeFilters.length > 0 || filters.search !== "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-48 max-w-72 flex-1">
        <Search
          aria-hidden
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-sub"
        />
        <input
          type="search"
          name="search"
          aria-label="Search tasks"
          placeholder="Search tasks..."
          value={filters.search}
          onChange={(event) => updateFilters("search", event.target.value)}
          className="w-full rounded-lg border bg-surface py-2 pl-9 pr-3 text-sm text-text-main placeholder:text-text-sub/60 focus:border-brand focus:outline-none"
        />
      </label>

      <button
        type="button"
        title="Show filters"
        aria-label="Show filters"
        aria-expanded={isOpen}
        onClick={onToggle}
        className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium ${isOpen || activeFilters.length > 0 ? "border-brand/40 bg-brand/10 text-brand" : "bg-surface text-text-main hover:bg-brand/10"}`}
      >
        <SlidersHorizontal aria-hidden size={16} />
        Filter
        {activeFilters.length > 0 && (
          <span className="rounded-full bg-brand px-1.5 text-xs text-white">
            {activeFilters.length}
          </span>
        )}
        <ToggleIcon aria-hidden size={14} />
      </button>

      <ActiveFilterChips
        filters={activeFilters}
        onClear={(filter) => updateFilters(filter.name, filter.defaultValue)}
      />

      {hasAnythingToClear && (
        <button
          type="button"
          onClick={resetFilters}
          className="cursor-pointer text-sm font-medium text-brand hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
