import { EmptyState, ErrorState, LoadingState } from "../components/ui";
import { TaskCalendar, TasksHeader } from "../features/tasks/components";
import TaskPopups from "../features/tasks/components/TaskPopups";
import { useTasks } from "../features/tasks/hooks/useTasks";

export default function CalendarView() {
  const {
    data,
    isLoading,
    error,
    isStale,
    isSearching,
    filters,
    resetFilters,
    updateFilters,
  } = useTasks({ perPage: null });

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
  } else if (tasks && tasks.length > 0) {
    MainContent = <TaskCalendar tasks={data?.tasks ?? []} />;
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
