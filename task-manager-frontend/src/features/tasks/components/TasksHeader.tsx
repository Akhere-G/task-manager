import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { CountChip } from "../../../components/ui";
import FilterPanel from "./FilterPanel";

export interface TaskFilters {
  search: string;
  project: string;
  label: string;
  priority: string;
  duration: string;
  isCompleted: string;
  sortBy: string;
  order: string;
}

interface TasksHeaderProps {
  filters: TaskFilters;
  updateFilters: (name: string, value: string) => void;
  resetFilters: () => void;
  totalTasks: number;
  sortable?: boolean;
  /** The list has a group for completed tasks, so it cannot filter on them. */
  canFilterCompleted?: boolean;
}

export default function TasksHeader({
  filters,
  updateFilters,
  resetFilters,
  totalTasks,
  sortable = true,
  canFilterCompleted = true,
}: TasksHeaderProps) {
  const [openFilters, setOpenFilters] = useState(false);

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <header className="flex flex-col">
          <h1 className="text-3xl font-bold text-text-main transition-colors">
            Tasks <CountChip count={totalTasks} />
          </h1>
          <p className="text-text-sub">Manage your daily goals.</p>
        </header>

        <button
          type="button"
          title="Show filters"
          aria-label="Show filters"
          aria-expanded={openFilters}
          onClick={() => setOpenFilters(!openFilters)}
          className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium ${openFilters ? "bg-brand text-white" : "bg-surface text-text-main hover:bg-brand/10"}`}
        >
          <SlidersHorizontal aria-hidden size={16} />
          Filters
        </button>
      </div>

      {openFilters && (
        <FilterPanel
          filters={filters}
          updateFilters={updateFilters}
          resetFilters={resetFilters}
          sortable={sortable}
          canFilterCompleted={canFilterCompleted}
        />
      )}
    </div>
  );
}
