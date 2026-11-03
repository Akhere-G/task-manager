import { useState } from "react";
import { FormInput } from "../../../components/ui";
import {
  completedTasksOptions,
  isAscOptions,
  priorityFilterOptions,
  sortByOptions,
  taskDurationOptions,
} from "../constants";
import { ChevronDown, ChevronUp } from "lucide-react";
import useProjects from "../../projects/hooks/useProjects";
import { projectOptions } from "../../projects/utils";
import useLabels from "../../labels/hooks/useLabels";

interface TaskFilters {
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
}

export default function TasksHeader({
  filters,
  updateFilters,
  resetFilters,
  totalTasks,
  sortable = true,
}: TasksHeaderProps) {
  const [openFilters, setOpenFilters] = useState(false);
  const { data: projects = [] } = useProjects();
  const { data: labels = [] } = useLabels();

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
            name="project"
            value={filters.project}
            handleChange={handleChange}
            label="Project"
            options={[{ name: "All", value: "" }, ...projectOptions(projects)]}
            formClassNames={formClassNames}
          />
          <FormInput
            name="label"
            value={filters.label}
            handleChange={handleChange}
            label="Label"
            options={[
              { name: "All", value: "" },
              ...labels.map((label) => ({
                name: label.name,
                value: String(label.id),
              })),
            ]}
            formClassNames={formClassNames}
          />
          <FormInput
            name="priority"
            value={filters.priority}
            handleChange={handleChange}
            label="Priority"
            options={priorityFilterOptions}
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
            aria-label="Reset Filters"
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
