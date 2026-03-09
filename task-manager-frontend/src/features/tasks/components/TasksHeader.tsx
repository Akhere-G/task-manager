import { useState } from "react";
import { FormInput } from "../../../components/ui";
import {
  categoryOptions,
  completedTasksOptions,
  dueDateOptions,
  isAscOptions,
  sortByOptions,
  taskDurationOptions,
} from "../constants";
import { ChevronDown, ChevronUp } from "lucide-react";

interface TaskFilters {
  search: string;
  category: string;
  duration: string;
  isCompleted: string;
  dueDate: string;
  sortBy: string;
  order: string;
}
interface TasksHeaderProps {
  filters: TaskFilters;
  updateFilters: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => void;
  resetFilters: () => void;
  totalTasks: number;
  sortable?: boolean;
  showDueDateFilter?: boolean;
}

export default function TasksHeader({
  filters,
  updateFilters,
  resetFilters,
  totalTasks,
  sortable = true,
  showDueDateFilter = true,
}: TasksHeaderProps) {
  const [openFilters, setOpenFilters] = useState(false);

  const ButtonIcon = openFilters ? ChevronUp : ChevronDown;
  const formClassNames = "grow lg:grow-[0.9] max-w-80";
  return (
    <div
      className={`card flex justify-between items-center sm:items-start flex-col gap-5 ${openFilters ? "lg:flex-row" : "md:flex-row"}`}
    >
      <header className="grow-[0.9] shrink-0 w-full max-w-52 flex flex-col items-center sm:items-start">
        <h1 className="text-3xl font-bold text-text-main transition-colors">
          Tasks ({totalTasks})
        </h1>
        <p className="text-text-sub">Manage your daily goals.</p>
      </header>

      {openFilters && (
        <form className="flex gap-4 items-baseline flex-row flex-wrap">
          <FormInput
            name="search"
            value={filters.search}
            handleChange={updateFilters}
            label="Search"
            formClassNames={formClassNames}
          />
          <FormInput
            name="category"
            value={filters.category}
            handleChange={updateFilters}
            label="Category"
            options={categoryOptions}
            formClassNames={formClassNames}
          />
          <FormInput
            name="duration"
            value={filters.duration}
            handleChange={updateFilters}
            label="Duration"
            options={taskDurationOptions}
            formClassNames={formClassNames}
          />
          <FormInput
            name="isCompleted"
            value={filters.isCompleted}
            handleChange={updateFilters}
            label="Is Complete"
            options={completedTasksOptions}
            formClassNames={formClassNames}
          />
          {showDueDateFilter && (
            <FormInput
              name="dueDate"
              value={filters.dueDate}
              handleChange={updateFilters}
              label="Due Date"
              options={dueDateOptions}
              formClassNames={formClassNames}
            />
          )}
          {sortable && (
            <>
              <FormInput
                name="sortBy"
                value={filters.sortBy}
                handleChange={updateFilters}
                label="Sort By"
                options={sortByOptions}
                formClassNames={formClassNames}
              />
              <FormInput
                name="order"
                value={filters.order}
                handleChange={updateFilters}
                label="Order"
                options={isAscOptions}
                formClassNames={formClassNames}
              />
            </>
          )}
          <button
            type="button"
            className="self-end mb-1 btn-primary h-10"
            onClick={resetFilters}
          >
            Reset Filters
          </button>
        </form>
      )}
      <button
        className="md:m-0 sm:mx-auto"
        title="Show filters"
        aria-label="Show filters"
        onClick={() => setOpenFilters(!openFilters)}
      >
        {<ButtonIcon aria-hidden />}
      </button>
    </div>
  );
}
