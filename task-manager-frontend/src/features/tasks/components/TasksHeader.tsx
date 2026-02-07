import { FormInput } from "../../../components/ui";
import { categoryOptions, completedTasksOptions, dueDateOptions, isAscOptions, sortByOptions, taskDurationOptions } from "../constants";

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
  updateFilters: (e : React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  resetFilters: () => void; 
  totalTasks: number;
}

export default function TasksHeader({ filters, updateFilters, resetFilters, totalTasks }: TasksHeaderProps){
  return (
    <div className="card flex justify-between items-center sm:items-start flex-col lg:flex-row gap-5">
        <header className="grow-[0.9] shrink-0 w-full max-w-52 flex flex-col items-center sm:items-start">
          <h1 className="text-3xl font-bold text-text-main transition-colors">Tasks ({totalTasks})</h1>
          <p className="text-text-sub">Manage your daily goals.</p>
        </header>
        <form className="flex gap-4 items-baseline flex-row flex-wrap grow-[0.5]">
          <FormInput 
            name="search"
            value={filters.search}
            handleChange={updateFilters}
            label="Search"
            formClassNames="grow-[0.9] max-w-52"
          />
          <FormInput 
            name="category"
            value={filters.category}
            handleChange={updateFilters}
            label="Category"
            options={categoryOptions}
            formClassNames="grow-[0.9] max-w-52"
          />
          <FormInput 
            name="duration"
            value={filters.duration}
            handleChange={updateFilters}
            label="Duration"
            options={taskDurationOptions}
            formClassNames="grow-[0.9] max-w-52"
          />
          <FormInput 
            name="isCompleted"
            value={filters.isCompleted}
            handleChange={updateFilters}
            label="Is Complete"
            options={completedTasksOptions}
            formClassNames="grow-[0.9] max-w-52"
          />
          <FormInput 
            name="dueDate"
            value={filters.dueDate}
            handleChange={updateFilters}
            label="Due Date"
            options={dueDateOptions}
            formClassNames="grow-[0.9] max-w-52"
          />
          <FormInput 
            name="sortBy"
            value={filters.sortBy}
            handleChange={updateFilters}
            label="Sort By"
            options={sortByOptions}
            formClassNames="grow-[0.9] max-w-52"
          />
          <FormInput 
            name="order"
            value={filters.order}
            handleChange={updateFilters}
            label="Order"
            options={isAscOptions}
            formClassNames="grow-[0.9] max-w-52"
          />
            <button 
              type="button"
              className="self-end mb-1 btn-primary"
              onClick={resetFilters}
            >
              Reset Filters
            </button>
        </form>
      </div>
  )
}