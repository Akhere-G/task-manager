import { useDeferredValue, useEffect, useState, type JSX } from "react";
import { categories, type CreateTaskInput, type Task } from "../features/tasks/types";
import { taskService } from "../services/api";
import TaskForm from "../features/tasks/components/TaskForm";
import { EmptyState, LoadingState, ErrorState, Popup, FormInput } from "../components/ui";
import TaskList from "../features/tasks/components/TaskList";

export default function Home() {
  const [tasks, setTasks] = useState<null | Task[]>(null)
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null)
  const [selectedDeleteTask, setSelectedDeleteTask] = useState<Task | null>(null)
  const [selectedEditTask, setSelectedEditTask] = useState<Task | null>(null)
  const [filters, setFilters] = useState({
    search: "",
    category: "",
    duration: "",
    isCompleted: "",
    dueDate: ""
  })

  const deferredSearch = useDeferredValue(filters.search)

  useEffect(() => {
    async function fetchTasks() {
      setIsLoading(true)      
      try {
        const params = new URLSearchParams()
        const apiParamMap: Record<string, string> = {
        search: "q",
        category: "category",
        duration: "task_duration",
        isCompleted: "is_completed",
        dueDate: "due_date"
      };

      Object.entries(filters).forEach(([key, value]) => {
        console.log(key, String(value), apiParamMap[key])
        if (value) {
          key === "isCompleted" && console.log("value is true", true )
          params.set(apiParamMap[key], value);
        } else {
          params.delete(apiParamMap[key])
        }
      });

      if (filters.dueDate) {
        params.set("today", new Date().toISOString().substring(0, 10));
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
    
    const delayDebounceFn = setTimeout(fetchTasks, filters.search ? 400 : 0)
    return () => clearTimeout(delayDebounceFn)

  }, [filters]);

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
  if (!selectedEditTask || !tasks) return;

  const prevTasks = tasks;

  const rawData = {
    title: newTask.title.trim(),
    description: newTask.description.trim(),
    category: newTask.category,
    dueDate: newTask.dueDate,
    estimatedTime: newTask.estimatedTime,
  };

  const patchData: Partial<Task> = Object.fromEntries(
    Object.entries(rawData).filter(([, value]) => value !== "")
  );

  try {
    // 3. Optimistic Update (UI needs the merged data to stay consistent)
    const updatedTask: Task = {
      ...selectedEditTask,
      ...patchData,
    };

    setTasks(tasks.map(t => (t.id === selectedEditTask.id ? updatedTask : t)));

    // 4. Send ONLY the non-empty fields to the backend
    await taskService.update(selectedEditTask.id, patchData);
    
    setSelectedEditTask(null);
  } catch (err) {
    setTasks(prevTasks);
    console.error("Update failed:", err);
    throw err;
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

  const isStale = isLoading || filters.search !== deferredSearch

  const isSearching = !!filters.search || filters.category !== ""

  const updateFilters = (e : React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, [e.target.name] : e.target.value }))
  }

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
        <form className="flex gap-4 items-baseline flex-col sm:flex-row flex-wrap">
          <FormInput 
            name="search"
            value={filters.search}
            handleChange={updateFilters}
            label="Search"
          />
          <FormInput 
            name="category"
            value={filters.category}
            handleChange={updateFilters}
            label="Category"
            options={categoryOptions}
          />
          <FormInput 
            name="duration"
            value={filters.duration}
            handleChange={updateFilters}
            label="Duration"
            options={taskDurationOptions}
          />
          <FormInput 
            name="isCompleted"
            value={filters.isCompleted}
            handleChange={updateFilters}
            label="Is Complete"
            options={completedTasksOptions}
          />
          <FormInput 
            name="dueDate"
            value={filters.dueDate}
            handleChange={updateFilters}
            label="Due Date"
            options={dueDateOptions}
          />
          </form>
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
