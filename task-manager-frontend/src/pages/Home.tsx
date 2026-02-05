import { useDeferredValue, useEffect, useState, type JSX } from "react";
import TaskCard from "../features/tasks/components/TaskCard";
import { categories, type CreateTaskInput, type Task } from "../features/tasks/types";
import { taskService } from "../services/api";
import Popup from "../components/ui/Popup";
import TaskForm from "../features/tasks/components/TaskForm";

export default function Home() {
  const [tasks, setTasks] = useState<null | Task[]>(null)
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null)
  const [selectedDeleteTask, setSelectedDeleteTask] = useState<Task | null>(null)
  const [selectedEditTask, setSelectedEditTask] = useState<Task | null>(null)
  const [category, setCategory] = useState("")
  const [search, setSearch] = useState("")
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

  }, [category, search]);

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

  const options = [
    { name: "All", value: "" }, 
    ...categories
  ]

  let MainContent: JSX.Element = <EmptyState isSearching={isSearching} />

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
    /* bg-canvas handles the main background transition */
    <section className="flex flex-col gap-6 min-h-full">
      <div className="flex justify-between bg-surface p-4 rounded-xl items-baseline">
        <header>
          <h1 className="text-3xl font-bold text-text-main transition-colors">Tasks</h1>
          <p className="text-text-sub">Manage your daily goals.</p>
        </header>
        <div className="flex gap-4 items-baseline">
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
            {options.map(({ name, value }) => <option key={value} value={value}>{name}</option>)}
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
interface ErrorStateProps {
  error: string;
}

function ErrorState({ error }: ErrorStateProps){
  return (
    <div className="p-6 text-center rounded-xl border animate-in fade-in duration-500
        bg-failure/10 border-failure/20 text-failure"
      >
        <div className="text-4xl mb-3">⚠️</div>
        <h2 className="text-lg font-bold">Something went wrong</h2>
        <p className="text-sm opacity-90 mb-4">{error}</p>
        
        <button 
          onClick={() => window.location.reload()} 
          className="px-6 py-2 rounded-lg bg-failure text-white font-bold hover:brightness-110 transition-all shadow-sm"
        >
          Try Again
        </button>
      </div>
  )
}

function LoadingState({ loadMessage = 'Loading' }: { loadMessage?: string }){
  return (
    <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        <p className="ml-3 text-text-sub">{loadMessage}</p>
      </div>
  )
}

function EmptyState({ isSearching }:{ isSearching: boolean }) {
  return (
    <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
      <p className="text-text-sub">{isSearching ? "Your search returned no tasks" :"No tasks found. Time to relax!"}</p>
    </div>
  );
}

interface TaskListProps {
  tasks: Task[]
  handleConfirmDelete: (id: number) => void;
  handleConfirmEdit: (id: number) => void;
  setIsCompleted: (id: number, isCompleted: boolean) => Promise<void>
}

function TaskList({tasks, handleConfirmDelete, handleConfirmEdit, setIsCompleted}: TaskListProps){
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tasks.map(task => (
            <li key={task.id} className="transition-all duration-500 animate-in fade-in slide-in-from-bottom-2">
              <TaskCard 
                {...task} 
                onDelete={handleConfirmDelete}
                onEdit={handleConfirmEdit} 
                setIsCompleted={setIsCompleted}
              />
            </li>
          ))}
        </ul> 
  )
}