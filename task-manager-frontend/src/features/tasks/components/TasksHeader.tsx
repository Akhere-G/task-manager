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
  updateFilters: (name: string, value: string) => void;
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

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    updateFilters(name, value);
  };
  const ButtonIcon = openFilters ? ChevronUp : ChevronDown;
  const formClassNames = "grow lg:grow-[0.9] max-w-80";
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex justify-between items-start gap-2">
        <header className="w-full max-w-52 flex flex-col">
          <h1 className="text-3xl font-bold text-text-main transition-colors">
            Tasks ({totalTasks})
          </h1>
          <p className="text-text-sub">Manage your daily goals.</p>
        </header>

        <button
          className=""
          title="Show filters"
          aria-label="Show filters"
          onClick={() => setOpenFilters(!openFilters)}
        >
          {<ButtonIcon aria-hidden />}
        </button>
      </div>

      {openFilters && (
        <form
          className="flex gap-4 items-baseline flex-row flex-wrap"
          onSubmit={(e) => e.preventDefault()}
        >
          <FormInput
            name="search"
            value={filters.search}
            handleChange={handleChange}
            label="Search"
            formClassNames={formClassNames}
          />
          <FormInput
            name="category"
            value={filters.category}
            handleChange={handleChange}
            label="Category"
            options={categoryOptions}
            formClassNames={formClassNames}
          />
          <FormInput
            name="duration"
            value={filters.duration}
            handleChange={handleChange}
            label="Duration"
            options={taskDurationOptions}
            formClassNames={formClassNames}
          />
          <FormInput
            name="isCompleted"
            value={filters.isCompleted}
            handleChange={handleChange}
            label="Is Complete"
            options={completedTasksOptions}
            formClassNames={formClassNames}
          />
          {showDueDateFilter && (
            <FormInput
              name="dueDate"
              value={filters.dueDate}
              handleChange={handleChange}
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
                handleChange={handleChange}
                label="Sort By"
                options={sortByOptions}
                formClassNames={formClassNames}
              />
              <FormInput
                name="order"
                value={filters.order}
                handleChange={handleChange}
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
    </div>
  );
}
