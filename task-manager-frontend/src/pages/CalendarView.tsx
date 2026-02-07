import { EmptyState, ErrorState, LoadingState } from "../components/ui";
import { TaskCalendar, TasksHeader } from "../features/tasks/components";
import useGetTasks from "../features/tasks/hooks/useGetTasks";
import TaskPopups from "../features/tasks/components/TaskPopups";

export default function CalendarView() {
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
      isStale,
      isSearching,
    } = useGetTasks()

  let MainContent = <EmptyState  searchMessage={ isSearching ? "Your search returned no tasks" :"No tasks found. Time to relax!"} />

  if (error) {
      MainContent = <ErrorState error={error}/>
    } else if (isLoading && (!tasks || tasks.length === 0)) {
      MainContent = <LoadingState loadMessage="Getting tasks..."/>
    } else if (tasks && tasks.length > 0) {
      MainContent = (
      <TaskCalendar
        handleConfirmDelete={handleConfirmDelete}
        handleConfirmEdit={handleConfirmEdit}
        setIsCompleted={setIsCompleted}
        tasks={tasks}
      />)
    } 

  return (
    <section className="flex flex-col gap-6 min-h-full">
      <TasksHeader 
        filters={filters} 
        updateFilters={updateFilters} 
        resetFilters={resetFilters} 
        totalTasks={pageDetails.totalItems}
        sortable={false}

      />
      <section className={`transition-opacity duration-200 ${isStale ? 'opacity-75' : 'opacity-100'}`}>
        {MainContent}
      </section>
      <TaskPopups 
        handleDelete={handleDelete}
        closeDeletePopup={closeDeletePopup}
        selectedDeleteTask={selectedDeleteTask}
        handleEdit={handleEdit}
        closeEditPopup={closeEditPopup}
        selectedEditTask={selectedEditTask}
      />
    </section>
  )
}
