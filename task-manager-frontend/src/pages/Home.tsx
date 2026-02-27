import {
  EmptyState,
  LoadingState,
  ErrorState,
  Pagination,
} from "../components/ui";
import { DailyBrief } from "../features/ai/components";
import { TasksHeader, TaskList } from "../features/tasks/components";
import TaskPopups from "../features/tasks/components/TaskPopups";
import { useTasks } from "../features/tasks/hooks/useTasks";

const PER_PAGE = 10;

export default function Home() {
  const {
    data,
    isLoading,
    error,
    pageDetails,
    setPage,
    isStale,
    isSearching,
    filters,
    resetFilters,
    updateFilters,
  } = useTasks({ perPage: PER_PAGE });

  const tasks = data?.tasks || null;

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
  } else if (isLoading && (!tasks || tasks.length === 0)) {
    MainContent = <LoadingState loadMessage="Getting tasks..." />;
  } else if (tasks && tasks.length > 0) {
    MainContent = <TaskList tasks={data?.tasks ?? []} />;
  }

  return (
    <section className="flex flex-col gap-6 min-h-full">
      <TasksHeader
        filters={filters}
        resetFilters={resetFilters}
        totalTasks={data?.totalTasks || 0}
        updateFilters={updateFilters}
      />

      {!isSearching && pageDetails.currentPage === 1 && <DailyBrief />}

      {tasks && tasks.length > 0 && (
        <Pagination {...pageDetails} setPage={setPage} />
      )}

      <section
        className={`transition-opacity duration-200 ${isStale ? "opacity-75" : "opacity-100"}`}
      >
        {MainContent}
      </section>

      {tasks && tasks.length > 0 && (
        <Pagination {...pageDetails} setPage={setPage} scrollUpOnNavigate />
      )}

      {tasks && <TaskPopups />}
    </section>
  );
}
