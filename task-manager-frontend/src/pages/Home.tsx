import { useEffect } from "react";
import { EmptyState, LoadingState, ErrorState, Pagination } from "../components/ui";
import { useTaskContext } from "../context/TaskContext";
import { TasksHeader, TaskList } from "../features/tasks/components";
import TaskPopups from "../features/tasks/components/TaskPopups";

const PER_PAGE = 10;

export default function Home() {
  const {
    tasks,
    isLoading,
    error,
    filters,
    pageDetails,
    setPage,
    isStale,
    isSearching,
    deferredSearch,
    fetchTasks
  } = useTaskContext()

  useEffect(() => {
      const delayDebounceFn = setTimeout(() => fetchTasks(PER_PAGE), deferredSearch ? 400 : 0);
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

  let MainContent = <EmptyState searchMessage={ isSearching ? "Your search returned no tasks" :"No tasks found. Time to relax!"} />

  if (error) {
    MainContent = <ErrorState error={error}/>
  } else if (isLoading && (!tasks || tasks.length === 0)) {
    MainContent = <LoadingState loadMessage="Getting tasks..."/>
  } else if (tasks && tasks.length > 0) {
    MainContent = (
    <TaskList />)
  } 

  return (
    <section className="flex flex-col gap-6 min-h-full">
      <TasksHeader />

    {tasks && tasks.length > 0 && <Pagination {...pageDetails} setPage={setPage} />}

    <section className={`transition-opacity duration-200 ${isStale ? 'opacity-75' : 'opacity-100'}`}>
      {MainContent}
    </section>

    {tasks && tasks.length > 0 && <Pagination {...pageDetails} setPage={setPage} scrollUpOnNavigate/>}

    {tasks && <TaskPopups />}
    </section>
  )
}
