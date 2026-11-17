import { useState } from "react";
import { CountChip } from "../../../components/ui";
import type { TaskFilters } from "../taskParams";
import FilterPanel from "./FilterPanel";
import FilterToolbar from "./FilterToolbar";

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
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="card flex flex-col gap-3">
      <header className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-3xl font-bold text-text-main transition-colors">
          Tasks <CountChip count={totalTasks} />
        </h1>
        <p className="text-text-sub">Manage your daily goals.</p>
      </header>

      <FilterToolbar
        filters={filters}
        updateFilters={updateFilters}
        resetFilters={resetFilters}
        canFilterCompleted={canFilterCompleted}
        isOpen={isOpen}
        onToggle={() => setIsOpen(!isOpen)}
      />
      {isOpen && (
        <FilterPanel
          filters={filters}
          updateFilters={updateFilters}
          sortable={sortable}
          canFilterCompleted={canFilterCompleted}
        />
      )}
    </div>
  );
}
