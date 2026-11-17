import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
} from "../components/ui";
import { DailyBrief } from "../features/ai/components";
import KanbanBoard from "../features/columns/components/KanbanBoard";
import {
  EisenhowerMatrix,
  TaskCalendar,
  TaskList,
  TasksHeader,
} from "../features/tasks/components";
import LayoutToggle from "../features/tasks/components/LayoutToggle";
import { BulkActionBar } from "../features/tasks/components/BulkActionBar";
import ShowingRange from "../features/tasks/components/ShowingRange";
import QuickCapture from "../features/tasks/components/QuickCapture";
import TaskPopups from "../features/tasks/components/TaskPopups";
import TasksSidebar from "../features/tasks/components/TasksSidebar";
import useTaskCounts from "../features/tasks/hooks/useTaskCounts";
import { useTasks } from "../features/tasks/hooks/useTasks";
import { SelectionProvider } from "../features/tasks/selection/SelectionProvider";
import type { TaskFilters } from "../features/tasks/taskParams";
import type { Task } from "../features/tasks/types";
import type { TaskLayout, TaskView } from "../features/tasks/views";

const PER_PAGE = 10;

interface TasksBodyProps {
  tasks: Task[];
  layout: TaskLayout;
  filters: TaskFilters;
  search: string;
  view: TaskView;
  currentDate: string;
  setCurrentDate: (date: Date) => void;
  projectId: number | null;
  isInbox: boolean;
  sortable: boolean;
  groupByDate: boolean;
}

function TasksBody({
  tasks,
  layout,
  filters,
  search,
  view,
  currentDate,
  setCurrentDate,
  projectId,
  isInbox,
  sortable,
  groupByDate,
}: TasksBodyProps) {
  if (layout === "calendar") {
    return (
      <TaskCalendar
        tasks={tasks}
        currentDate={new Date(currentDate)}
        setCurrentDate={setCurrentDate}
      />
    );
  }
  if (layout === "kanban") {
    return projectId === null ? (
      <EmptyState searchMessage="Select a project to see its board." />
    ) : (
      <KanbanBoard
        projectId={projectId}
        filters={filters}
        search={search}
        view={view}
      />
    );
  }
  if (layout === "matrix") {
    return <EisenhowerMatrix filters={filters} search={search} view={view} />;
  }
  if (tasks.length === 0) {
    return (
      <EmptyState
        searchMessage={
          isInbox
            ? "Your inbox is empty. Capture something above."
            : "No tasks found. Time to relax!"
        }
      />
    );
  }
  return (
    <TaskList tasks={tasks} sortable={sortable} groupByDate={groupByDate} />
  );
}

export default function TasksPage() {
  const {
    data,
    isLoading,
    error,
    pageDetails,
    setPage,
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
  } = useTasks({ perPage: PER_PAGE });
  const { data: counts } = useTaskCounts();
  const navigate = useNavigate();

  const tasks = data?.tasks ?? [];
  const projectId = filters.project ? Number(filters.project) : null;
  const isCalendar = layout === "calendar";
  const hasTasks = tasks.length > 0;
  const showsPagination = layout === "list";

  let content = (
    <TasksBody
      tasks={tasks}
      layout={layout}
      filters={filters}
      search={search}
      view={view}
      currentDate={filters.currentDate}
      setCurrentDate={(date) =>
        updateFilters("currentDate", date.toISOString())
      }
      projectId={projectId}
      isInbox={view === "inbox" && !isSearching}
      sortable={
        layout === "list" &&
        filters.sortBy === "manual" &&
        filters.order === "asc"
      }
      groupByDate={filters.sortBy === "start_at"}
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
                {showsPagination && (
                  <Pagination {...pageDetails} setPage={setPage} />
                )}
              </div>
            )}

            <section
              className={`transition-opacity duration-150 -row-start-1 ${isStale ? "opacity-75" : "opacity-100"}`}
            >
              {content}
            </section>

            {showsPagination && hasTasks && (
              <div className="flex flex-col items-center justify-between gap-2 md:flex-row">
                <ShowingRange
                  currentPage={pageDetails.currentPage}
                  perPage={PER_PAGE}
                  totalItems={pageDetails.totalItems}
                  isCompleted={filters.isCompleted}
                />
                <Pagination
                  {...pageDetails}
                  setPage={setPage}
                  scrollUpOnNavigate
                />
              </div>
            )}

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
