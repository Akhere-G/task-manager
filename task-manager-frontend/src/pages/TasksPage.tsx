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
  TaskCalendar,
  TaskList,
  TasksHeader,
} from "../features/tasks/components";
import LayoutToggle from "../features/tasks/components/LayoutToggle";
import QuickCapture from "../features/tasks/components/QuickCapture";
import TaskPopups from "../features/tasks/components/TaskPopups";
import ViewNav from "../features/tasks/components/ViewNav";
import useTaskCounts from "../features/tasks/hooks/useTaskCounts";
import { useTasks } from "../features/tasks/hooks/useTasks";
import type { Task } from "../features/tasks/types";

const PER_PAGE = 10;

interface TasksBodyProps {
  tasks: Task[];
  isCalendar: boolean;
  currentDate: string;
  setCurrentDate: (date: Date) => void;
  isInbox: boolean;
}

function TasksBody({
  tasks,
  isCalendar,
  currentDate,
  setCurrentDate,
  isInbox,
}: TasksBodyProps) {
  if (isCalendar) {
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
  return <TaskList tasks={tasks} />;
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
      isCalendar={isCalendar}
      currentDate={filters.currentDate}
      setCurrentDate={(date) =>
        updateFilters("currentDate", date.toISOString())
      }
      isInbox={view === "inbox" && !isSearching}
    />
  );
  if (error) {
    content = <ErrorState error={error} />;
  } else if (isLoading && !hasTasks) {
    content = <LoadingState loadMessage="Getting tasks..." />;
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:gap-6">
      <aside className="md:w-48 md:shrink-0">
        <ViewNav view={view} counts={counts} onSelect={selectView} />
      </aside>

      <section className="flex min-h-full min-w-0 grow flex-col gap-3">
        <TasksHeader
          filters={filters}
          resetFilters={resetFilters}
          totalTasks={data?.totalTasks ?? 0}
          updateFilters={updateFilters}
          sortable={!isCalendar}
        />
        <LayoutToggle layout={layout} onSelect={selectLayout} />
        {view === "inbox" && <QuickCapture />}

        {!isCalendar && hasTasks && (
          <div className="flex flex-wrap justify-center gap-4">
            <DailyBrief />
            <Pagination {...pageDetails} setPage={setPage} />
          </div>
        )}

        <section
          className={`transition-opacity duration-150 ${isStale ? "opacity-75" : "opacity-100"}`}
        >
          {content}
        </section>

        {!isCalendar && hasTasks && (
          <Pagination {...pageDetails} setPage={setPage} scrollUpOnNavigate />
        )}

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
        <TaskPopups />
      </section>
    </div>
  );
}
