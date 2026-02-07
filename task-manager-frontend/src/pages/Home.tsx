import { EmptyState, LoadingState, ErrorState, Pagination } from "../components/ui";
import { TasksHeader, TaskList } from "../features/tasks/components";
import TaskPopups from "../features/tasks/components/TaskPopups";
import useGetTasks from "../features/tasks/hooks/useGetTasks";

const PER_PAGE = 10;

export default function Home() {
  const {
    tasks,
    isLoading,
    error,
    selectedDeleteTask,
    selectedEditTask,
    handleConfirmDelete,
    closeDeletePopup,
    handleDelete,
    handleConfirmEdit,
    closeEditPopup,
    handleEdit,
    setIsCompleted,
    filters,
    pageDetails,
    updateFilters,
    resetFilters,
    setPage,
    isStale,
    isSearching,
  } = useGetTasks({ perPage: PER_PAGE })

  let MainContent = <EmptyState  searchMessage={ isSearching ? "Your search returned no tasks" :"No tasks found. Time to relax!"} />

  if (error) {
    MainContent = <ErrorState error={error}/>
  } else if (isLoading && (!tasks || tasks.length === 0)) {
    MainContent = <LoadingState loadMessage="Getting tasks..."/>
  } else if (tasks && tasks.length > 0) {
    MainContent = (
    <TaskList 
      tasks={tasks} 
      handleConfirmDelete={handleConfirmDelete} 
      handleConfirmEdit={handleConfirmEdit}
      setIsCompleted={setIsCompleted}
    />)
  } 

  return (
    <section className="flex flex-col gap-6 min-h-full">
      <TasksHeader 
        filters={filters} 
        updateFilters={updateFilters} 
        resetFilters={resetFilters} 
        totalTasks={pageDetails.totalItems} 
      />

    {tasks && tasks.length > 0 && <Pagination {...pageDetails} setPage={setPage} />}

    <section className={`transition-opacity duration-200 ${isStale ? 'opacity-75' : 'opacity-100'}`}>
      {MainContent}
    </section>

    {tasks && tasks.length > 0 && <Pagination {...pageDetails} setPage={setPage} scrollUpOnNavigate/>}

    {tasks && (
      <TaskPopups 
        selectedDeleteTask={selectedDeleteTask}
        selectedEditTask={selectedEditTask}
        closeDeletePopup={closeDeletePopup}
        closeEditPopup={closeEditPopup}
        handleDelete={handleDelete}
        handleEdit={handleEdit}
      />)}
    </section>
  )
}
