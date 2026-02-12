import { useTaskContext } from "../../../context/TaskContext";
import type { Task } from "../types";
import TaskCard from "./TaskCard";

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

export default function TaskListConnected(){
  const {
    tasks,
    handleConfirmDelete,
    handleConfirmEdit,
    setIsCompleted
  } = useTaskContext()

  return (
    <TaskList 
      tasks={tasks || []}
      handleConfirmDelete={handleConfirmDelete}
      handleConfirmEdit={handleConfirmEdit}
      setIsCompleted={setIsCompleted}
    />
  )
}