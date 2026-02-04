import { useEffect, useState } from "react";
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
    fetchTasks();
  }, [category]);

  const handleConfirmDelete = (id: number) => setSelectedDeleteTask(tasks?.find(t => t.id === id) || null)
  
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

  if (error) {
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
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        <p className="ml-3 text-text-sub">Getting tasks...</p>
      </div>
    );
  }

  const options = [
    { name: "All", value: "" }, 
    ...categories
  ]

  return (
    /* bg-canvas handles the main background transition */
    <section className="flex flex-col gap-6 min-h-full">
      <div className="flex justify-between">
        <header>
          <h1 className="text-3xl font-bold text-text-main transition-colors">Tasks</h1>
          <p className="text-text-sub">Manage your daily goals.</p>
        </header>
        <div className="bg-surface p-4 rounded-xl">

          <select 
            className="rounded-md px-3 py-2 my-2 outline-accent bg-surface-muted"
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
      {tasks && tasks.length > 0 ? (
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
      ) : (
        <EmptyState />
      )}
    </section>
  )
}

function EmptyState() {
  return (
    <div className="text-center py-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
      <p className="text-text-sub">No tasks found. Time to relax!</p>
    </div>
  );
}
