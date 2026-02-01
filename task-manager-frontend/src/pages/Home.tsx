import { useEffect, useState } from "react";
import TaskCard from "../features/tasks/components/TaskCard";
import type { Task } from "../features/tasks/types";
import { taskService } from "../services/api";

export default function Home() {
  const [tasks, setTasks] = useState<null | Task[]>(null)
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTasks() {
      setIsLoading(true)
      try {
        const newTasks = await taskService.getAll();
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
  }, []);

  async function handleDelete(id: number){
    try {
      const response = await taskService.delete(id);
      setTasks(prev => prev!.filter(task => task.id !== Number(response.id)))
    } catch (err) {
      console.log(err)
    }
  }

  async function setIsCompleted(id: number, isCompleted: boolean){
    try {
      const response = await taskService.update(id, { isCompleted })
      setTasks(prev => prev!.map(task => task.id === id ? response : task))
    } catch (err) {
      console.log(err)
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

  return (
    /* bg-canvas handles the main background transition */
    <section className="flex flex-col gap-6 min-h-full">
      <header>
        <h1 className="text-3xl font-bold text-text-main transition-colors">Tasks</h1>
        <p className="text-text-sub">Manage your daily goals.</p>
      </header>

      {tasks && tasks.length > 0 ? (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tasks.map(task => (
            <li key={task.id} className="transition-all duration-500 animate-in fade-in slide-in-from-bottom-2">
              <TaskCard {...task} onDelete={handleDelete} setIsCompleted={setIsCompleted}/>
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
