import {
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
} from "../components/ui";
import { TaskList, TasksHeader } from "../features/tasks/components";
import QuickCapture from "../features/tasks/components/QuickCapture";
import TaskPopups from "../features/tasks/components/TaskPopups";
import { getDefaultFilters, useTasks } from "../features/tasks/hooks/useTasks";

const PER_PAGE = 10;
const defaultFilters = { ...getDefaultFilters(), view: "inbox" };

export default function Inbox() {
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
  } = useTasks({ perPage: PER_PAGE, defaultFilters });

  const tasks = data?.tasks ?? null;

  let mainContent = (
    <EmptyState
      searchMessage={
        isSearching
          ? "Your search returned no tasks"
          : "Your inbox is empty. Capture something above."
      }
    />
  );
  if (error) {
    mainContent = <ErrorState error={error} />;
  } else if (isLoading && (!tasks || tasks.length === 0)) {
    mainContent = <LoadingState loadMessage="Getting your inbox..." />;
  } else if (tasks && tasks.length > 0) {
    mainContent = <TaskList tasks={tasks} />;
  }

  return (
    <section className="flex flex-col gap-3 min-h-full">
      <h1 className="text-2xl font-bold text-text-main">Inbox</h1>
      <QuickCapture />
      <TasksHeader
        filters={filters}
        resetFilters={resetFilters}
        totalTasks={data?.totalTasks || 0}
        updateFilters={updateFilters}
      />
      <section
        className={`transition-opacity duration-150 ${isStale ? "opacity-75" : "opacity-100"}`}
      >
        {mainContent}
      </section>
      {tasks && tasks.length > 0 && (
        <Pagination {...pageDetails} setPage={setPage} scrollUpOnNavigate />
      )}
      <TaskPopups />
    </section>
  );
}
