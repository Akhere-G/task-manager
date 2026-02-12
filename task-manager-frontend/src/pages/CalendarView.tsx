import { EmptyState, ErrorState, LoadingState } from "../components/ui";
import { TaskCalendar, TasksHeader } from "../features/tasks/components";
import TaskPopups from "../features/tasks/components/TaskPopups";
import { useTaskContext } from "../context/TaskContext";
import { useEffect } from "react";

export default function CalendarView() {
  const {
      tasks,
      isLoading,
      error,
      filters,
      pageDetails,
      isStale,
      isSearching,
      fetchTasks,
      deferredSearch,
      resetFilters
    } = useTaskContext()

    useEffect(() => {
          const delayDebounceFn = setTimeout(() => fetchTasks(null), deferredSearch ? 400 : 0);
          return () => clearTimeout(delayDebounceFn);
        }, [
          deferredSearch,
          filters.category,
          filters.duration,
          filters.isCompleted,
          filters.dueDate,
          filters.sortBy,
          filters.order,
          pageDetails.currentPage,
        ]);

  useEffect(() => {
    resetFilters()
  },[])

  let MainContent = <EmptyState  searchMessage={ isSearching ? "Your search returned no tasks" :"No tasks found. Time to relax!"} />

  if (error) {
      MainContent = <ErrorState error={error}/>
    } else if (isLoading && (!tasks || tasks.length === 0)) {
      MainContent = <LoadingState loadMessage="Getting tasks..."/>
    } else if (tasks && tasks.length > 0) {
      MainContent = (
      <TaskCalendar />)
    } 

  return (
    <section className="flex flex-col gap-6 min-h-full">
      <TasksHeader sortable={false} showDueDateFilter={false} />
      <section className={`transition-opacity duration-200 ${isStale ? 'opacity-75' : 'opacity-100'}`}>
        {MainContent}
      </section>
      <TaskPopups />
    </section>
  )
}
