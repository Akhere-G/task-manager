import { EmptyState } from "../../../components/ui";
import KanbanBoard from "../../columns/components/KanbanBoard";
import type { TaskFilters } from "../taskParams";
import type { Task } from "../types";
import type { TaskLayout, TaskView } from "../views";
import EisenhowerMatrix from "./EisenhowerMatrix";
import GroupedTaskList from "./GroupedTaskList";
import TaskCalendar from "./TaskCalendar";

interface TasksBodyProps {
  layout: TaskLayout;
  filters: TaskFilters;
  search: string;
  view: TaskView;
  projectId: number | null;
  /** The calendar draws these; the other layouts load their own. */
  calendarTasks: Task[];
  totalTasks: number;
  isInbox: boolean;
  currentDate: string;
  setCurrentDate: (date: Date) => void;
}

export default function TasksBody({
  layout,
  filters,
  search,
  view,
  projectId,
  calendarTasks,
  totalTasks,
  isInbox,
  currentDate,
  setCurrentDate,
}: TasksBodyProps) {
  if (layout === "calendar") {
    return (
      <TaskCalendar
        tasks={calendarTasks}
        currentDate={new Date(currentDate)}
        setCurrentDate={setCurrentDate}
      />
    );
  }
  if (layout === "kanban") {
    if (projectId === null) {
      return <EmptyState searchMessage="Select a project to see its board." />;
    }
    return (
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
  if (totalTasks === 0) {
    const emptyMessage = isInbox
      ? "Your inbox is empty. Capture something above."
      : "No tasks found. Time to relax!";
    return <EmptyState searchMessage={emptyMessage} />;
  }
  const isManualOrder = filters.sortBy === "manual" && filters.order === "asc";
  return (
    <GroupedTaskList
      query={{ filters, search, view }}
      sortable={isManualOrder}
    />
  );
}
