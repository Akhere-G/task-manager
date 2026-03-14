import { format } from "date-fns";
import { EmptyState, ErrorState, LoadingState } from "../components/ui";
import { TaskCalendar, TasksHeader } from "../features/tasks/components";
import TaskPopups from "../features/tasks/components/TaskPopups";
import { useTasks } from "../features/tasks/hooks/useTasks";

const defaultFilters = {
  search: "",
  category: "",
  duration: "",
  isCompleted: "false",
  dueDate: "calendar_view",
  sortBy: "start_at",
  order: "asc",
};

export default function CalendarView() {
  const {
    data,
    isLoading,
    error,
    isSearching,
    filters,
    resetFilters,
    updateFilters,
  } = useTasks({ perPage: null, defaultFilters });

  const tasks = data?.tasks ?? [];

  let MainContent = (
    <EmptyState
      searchMessage={
        isSearching
          ? "Your search returned no tasks"
          : "No tasks found. Time to relax!"
      }
    />
  );

  if (error) {
    MainContent = <ErrorState error={error} />;
  } else if (isLoading) {
    MainContent = <LoadingState loadMessage="Getting tasks..." />;
  } else if (tasks) {
    MainContent = (
      <TaskCalendar
        tasks={data?.tasks ?? []}
        currentDate={new Date(filters.currentDate)}
        setCurrentDate={(newDate: Date) => {
          updateFilters("currentDate", format(newDate, "yyyy-MM-dd"));
        }}
      />
    );
  }

  return (
    <section className="flex flex-col gap-6 min-h-full">
      <TasksHeader
        filters={filters}
        resetFilters={resetFilters}
        totalTasks={data?.totalTasks ?? 0}
        updateFilters={updateFilters}
        sortable={false}
        showDueDateFilter={false}
      />
      <section className={`transition-opacity duration-200`}>
        {MainContent}
      </section>
      <TaskPopups />
    </section>
  );
}
