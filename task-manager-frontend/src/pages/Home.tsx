import { useDeferredValue, useEffect, useState, type JSX } from "react";
import { categories, type CreateTaskInput, type Task } from "../features/tasks/types";
import { taskService } from "../services/api";
import TaskForm from "../features/tasks/components/TaskForm";
import { EmptyState, LoadingState, ErrorState, Popup } from "../components/ui";
import TaskList from "../features/tasks/components/TaskList";

export default function Home() {
  const [tasks, setTasks] = useState<null | Task[]>(null)
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null)
  const [selectedDeleteTask, setSelectedDeleteTask] = useState<Task | null>(null)
  const [selectedEditTask, setSelectedEditTask] = useState<Task | null>(null)
  const [category, setCategory] = useState("")
  const [taskDuration, setTaskDuration] = useState("")
  const [search, setSearch] = useState("")
  const [completedTasks, setCompletedTasks] = useState("")
  const [dueDate, setDueDate] = useState("")
  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    async function fetchTasks() {
      setIsLoading(true)      
      try {
        const params = new URLSearchParams()
        if (category){
          params.set("category", category)
        }
        else {
          params.delete("category")
        }

        if (search){
          params.set("q", search)
        } else {
          params.delete("q")
        }

        if (taskDuration){
          params.set("task_duration", taskDuration)
        } else {
          params.delete("task_duration")
        }

        if (completedTasks){
          params.set("is_completed", completedTasks)
        } else {
          params.delete("is_completed")
        }

        if (dueDate){
          params.set("due_date", dueDate)
          params.set("today", new Date().toISOString().substring(0, 10))
        } else {
          params.delete("due_date")
          params.delete("today")
        }

        const newTasks = await taskService.getAll(params);
        setTasks(newTasks);
        setError(null)
      } catch (err) {
        setError("Couldn't load tasks.");
        console.log(err)
      } finally {
        setIsLoading(false)
      }
    }
    
    const delayDebounceFn = setTimeout(fetchTasks, search ? 400 : 0)
    return () => clearTimeout(delayDebounceFn)

  }, [category, search, taskDuration, completedTasks, dueDate]);

  const handleConfirmDelete = (id: number) => setSelectedDeleteTask(tasks?.find(t => t.id === id) || null)
  
  async function handleDelete(id: number){
    const prevTasks = tasks;
    setTasks(prev => prev!.filter(task => task.id !== id))

    try {
      await taskService.delete(id);
    } catch (err) {
      console.log(err)
      setTasks(prevTasks)
    }
  }
  
  const handleConfirmEdit = (id: number) => setSelectedEditTask(tasks?.find(t => t.id === id) || null)
  
  async function handleEdit(newTask: CreateTaskInput) {
    if (!selectedEditTask){
      return;
    }
    const prevTasks = tasks;
    try {
      const updatedTask: Task = {
        ...selectedEditTask,
        id: selectedEditTask.id,
        title: newTask.title.trim() || selectedEditTask.title,
        category: newTask.category || selectedEditTask.category, 
        description: newTask.description.trim() || selectedEditTask.description,
        dueDate: newTask.dueDate || selectedEditTask.dueDate,
        estimatedTime: newTask.estimatedTime || selectedEditTask.estimatedTime,
      }      
      // need to use the new fields only if they are not empty

      setTasks(prev => prev!.map(task => task.id === selectedEditTask.id ? updatedTask : task ))
      await taskService.update(selectedEditTask.id, updatedTask);
      setSelectedEditTask(null);
    } catch (err) {
      console.log(err)
      setTasks(prevTasks)
      throw err // so that taskForm can dispaly error messages
    }
  }

  async function setIsCompleted(id: number, isCompleted: boolean){
    const prevTasks = tasks;
    try {
      setTasks(prev => prev!.map(task => task.id === id ? ({...task, isCompleted }) : task))
      await taskService.update(id, { isCompleted })
    } catch (err) {
      console.log(err)
      setTasks(prevTasks)
    }
  }

  const isStale = isLoading || search !== deferredSearch

  const isSearching = !!search || category !== ""

  const categoryOptions = [
    { name: "All", value: "" }, 
    ...categories
  ]

  const taskDurationOptions = [
    { name: "All", value: "" },
    { name: "Long Tasks", value: "long_tasks" },
    { name: "Short Tasks", value: "short_tasks" },
  ]

  const completedTasksOptions = [
    { name: "All", value: "" },
    { name: "Completed", value: "true" },
    { name: "Pending", value: "false" },
  ]

  const dueDateOptions = [
    { name: "All", value: "" },
    { name: "Today", value: "today" },
    { name: "This Week", value: "this_week" },
    { name: "This Month", value: "this_month" },
    { name: "Overdue", value: "overdue" },
  ]

  let MainContent: JSX.Element = <EmptyState  searchMessage={ isSearching ? "Your search returned no tasks" :"No tasks found. Time to relax!"} />

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
      <div className="flex justify-between bg-surface p-4 rounded-xl items-start sm:items-center flex-col sm:flex-row gap-5">
        <header>
          <h1 className="text-3xl font-bold text-text-main transition-colors">Tasks</h1>
          <p className="text-text-sub">Manage your daily goals.</p>
        </header>
        <div className="flex gap-4 items-baseline flex-col sm:flex-row flex-wrap">
          <input 
            name="search"
            className="rounded-md px-3 py-2 my-2 outline-accent bg-surface-muted"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select 
            className="rounded-md px-3 py-2 outline-accent bg-surface-muted text-sm"
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {categoryOptions.map(({ name, value }) => <option key={value} value={value}>{name}</option>)}
          </select>
          <select 
            className="rounded-md px-3 py-2 outline-accent bg-surface-muted text-sm"
            value={taskDuration}
            onChange={e => setTaskDuration(e.target.value)}
          >
            {taskDurationOptions.map(({ name, value }) => <option key={value} value={value}>{name}</option>)}
          </select>
          <select 
            className="rounded-md px-3 py-2 outline-accent bg-surface-muted text-sm"
            value={completedTasks}
            onChange={e => setCompletedTasks(e.target.value)}
          >
            {completedTasksOptions.map(({ name, value }) => <option key={value} value={value}>{name}</option>)}
          </select>
          <select 
            className="rounded-md px-3 py-2 outline-accent bg-surface-muted text-sm"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          >
            {dueDateOptions.map(({ name, value }) => <option key={value} value={value}>{name}</option>)}
          </select>
          </div>
      </div>

      {selectedDeleteTask && (
        <Popup 
          title="Delete Task"  
          close={() => setSelectedDeleteTask(null)}
          handleConfirm={() => {
            handleDelete(selectedDeleteTask.id); 
            setSelectedDeleteTask(null);
          }}
          actionText="Delete Task"
        >
          {`Delete task '${selectedDeleteTask.title}'?`}
        </Popup>
      )}
      {selectedEditTask && (
        <Popup 
          title={`Edit task '${selectedEditTask.title}'?`}
          close={() => setSelectedEditTask(null)}
          showCloseButton={false}
        >
          <TaskForm
            confirmButtonText="Edit Task"
            initialData={selectedEditTask}
            submitAction={handleEdit}
            close={(() => setSelectedEditTask(null))}
          />
        </Popup>
      )}
    <div className={`transition-opacity duration-200 ${isStale ? 'opacity-75' : 'opacity-100'}`}>
      {MainContent}
    </div>
    </section>
  )
}
