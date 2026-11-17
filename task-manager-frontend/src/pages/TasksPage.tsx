import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ErrorState, LoadingState } from "../components/ui";
import { DailyBrief } from "../features/ai/components";
import { TasksHeader } from "../features/tasks/components";
import LayoutToggle from "../features/tasks/components/LayoutToggle";
import { BulkActionBar } from "../features/tasks/components/BulkActionBar";
import TasksBody from "../features/tasks/components/TasksBody";
import QuickCapture from "../features/tasks/components/QuickCapture";
import TaskPopups from "../features/tasks/components/TaskPopups";
import TasksSidebar from "../features/tasks/components/TasksSidebar";
import useTaskCounts from "../features/tasks/hooks/useTaskCounts";
import { useTasks } from "../features/tasks/hooks/useTasks";
import { SelectionProvider } from "../features/tasks/selection/SelectionProvider";

export default function TasksPage() {
  const {
    data,
    isLoading,
    error,
    isStale,
    isSearching,
    filters,
    search,
    view,
    layout,
    selectView,
    selectLayout,
    resetFilters,
    updateFilters,
  } = useTasks();
  const { data: counts } = useTaskCounts();
  const navigate = useNavigate();

  const tasks = data?.tasks ?? [];
  const projectId = filters.project ? Number(filters.project) : null;
  const isCalendar = layout === "calendar";
  const hasTasks = tasks.length > 0;

  let content = (
    <TasksBody
      layout={layout}
      filters={filters}
      search={search}
      view={view}
      projectId={projectId}
      calendarTasks={tasks}
      totalTasks={data?.totalTasks ?? 0}
      isInbox={view === "inbox" && !isSearching}
      currentDate={filters.currentDate}
      setCurrentDate={(date) =>
        updateFilters("currentDate", date.toISOString())
      }
    />
  );
  if (error) {
    content = <ErrorState error={error} />;
  } else if (isLoading && !hasTasks) {
    content = <LoadingState loadMessage="Getting tasks..." />;
  }

  return (
    <SelectionProvider scope={JSON.stringify([layout, view, filters, search])}>
      <section className="flex min-h-full min-w-0 flex-col gap-3">
        <TasksHeader
          filters={filters}
          resetFilters={resetFilters}
          totalTasks={data?.totalTasks ?? 0}
          updateFilters={updateFilters}
          sortable={!isCalendar}
          canFilterCompleted={layout !== "list"}
        />
        <div className="grid grid-cols-[auto_1fr] items-start gap-3 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-x-6">
          <div className="md:row-span-2 md:self-baseline">
            <TasksSidebar
              view={view}
              counts={counts}
              project={filters.project}
              onSelectView={selectView}
              onSelectProject={(id) => updateFilters("project", id)}
            />
          </div>
          <div className="mr-2 overflow-y-scroll max-w-[50vw] justify-self-end md:mr-0 md:col-start-2 md:row-start-1 md:self-baseline">
            <LayoutToggle
              layout={layout}
              hasProject={projectId !== null}
              onSelect={selectLayout}
            />
          </div>
          <div className="col-span-2 flex min-w-0 flex-col gap-3 md:col-span-1 md:col-start-2 md:row-start-1 md:translate-y-12 md:pb-12">
            {view === "inbox" && <QuickCapture />}

            {!isCalendar && hasTasks && (
              <div className="flex flex-wrap justify-center gap-4 ">
                <DailyBrief />
              </div>
            )}

            <section
              className={`transition-opacity duration-150 -row-start-1 ${isStale ? "opacity-75" : "opacity-100"}`}
            >
              {content}
            </section>

            <TaskPopups />
            <BulkActionBar />
          </div>
        </div>

        <button
          aria-label="Add new task"
          className="z-1 fixed bottom-5 right-5 btn-primary rounded-full w-15 h-15 flex items-center justify-center shadow-xl"
          onClick={() =>
            navigate("/addtask", {
              state: isCalendar
                ? { currentDate: filters.currentDate }
                : undefined,
            })
          }
        >
          <Plus size={40} />
        </button>
      </section>
    </SelectionProvider>
  );
}
