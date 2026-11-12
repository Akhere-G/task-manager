import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Pagination,
} from "../components/ui";
import { DailyBrief } from "../features/ai/components";
import {
  EisenhowerMatrix,
  TaskCalendar,
  TaskList,
  TasksHeader,
} from "../features/tasks/components";
import LayoutToggle from "../features/tasks/components/LayoutToggle";
import QuickCapture from "../features/tasks/components/QuickCapture";
import TaskPopups from "../features/tasks/components/TaskPopups";
import TasksSidebar from "../features/tasks/components/TasksSidebar";
import useTaskCounts from "../features/tasks/hooks/useTaskCounts";
import { useTasks } from "../features/tasks/hooks/useTasks";
import type { Task } from "../features/tasks/types";
import type { TaskLayout } from "../features/tasks/views";

const PER_PAGE = 10;

interface TasksBodyProps {
  tasks: Task[];
  layout: TaskLayout;
  currentDate: string;
  setCurrentDate: (date: Date) => void;
  isInbox: boolean;
  sortable: boolean;
}

function TasksBody({
  tasks,
  layout,
  currentDate,
  setCurrentDate,
  isInbox,
  sortable,
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
  if (layout === "matrix") return <EisenhowerMatrix tasks={tasks} />;
  return <TaskList tasks={tasks} sortable={sortable} />;
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
  const isCalendar = layout === "calendar";
  const hasTasks = tasks.length > 0;

  let content = (
    <TasksBody
      tasks={tasks}
      layout={layout}
      currentDate={filters.currentDate}
      setCurrentDate={(date) =>
        updateFilters("currentDate", date.toISOString())
      }
      isInbox={view === "inbox" && !isSearching}
      sortable={
        layout === "list" &&
        filters.sortBy === "manual" &&
        filters.order === "asc"
      }
    />
  );
  if (error) {
    content = <ErrorState error={error} />;
  } else if (isLoading && !hasTasks) {
    content = <LoadingState loadMessage="Getting tasks..." />;
  }

  return (
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
        <div className="mr-2 justify-self-end md:mr-0 md:col-start-2 md:row-start-1 md:self-baseline">
          <LayoutToggle layout={layout} onSelect={selectLayout} />
        </div>
        <div className="col-span-2 flex min-w-0 flex-col gap-3 md:col-span-1 md:col-start-2 md:row-start-1 md:translate-y-12 md:pb-12">
          {view === "inbox" && <QuickCapture />}

          {!isCalendar && hasTasks && (
            <div className="flex flex-wrap justify-center gap-4 ">
              <DailyBrief />
              <Pagination {...pageDetails} setPage={setPage} />
            </div>
          )}

          <section
            className={`transition-opacity duration-150 -row-start-1 ${isStale ? "opacity-75" : "opacity-100"}`}
          >
            {content}
          </section>

          {!isCalendar && hasTasks && (
            <Pagination {...pageDetails} setPage={setPage} scrollUpOnNavigate />
          )}

          <TaskPopups />
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
  );
}
