import { useState } from "react";
import type { Task } from "../types";
import { Trash2, CheckCircle, Clock, AlertCircle, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { useTaskContext } from "../../../context/TaskContext";

interface TaskCardProps extends Task {
  setIsCompleted: (id: number, isComplete: boolean) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number) => void;
}

function TaskCard({
  id,
  title,
  category,
  description,
  isCompleted,
  dueDate,
  estimatedTime,
  setIsCompleted,
  onDelete,
  onEdit,
}: TaskCardProps) {
  const [showMore, setShowMore] = useState(false);
  const isOverdue = !isCompleted && new Date(dueDate) < new Date();

  const maxDescriptionLength = 100
  const isLongDesc = description.length > maxDescriptionLength
  const formattedDescription = isLongDesc && !showMore ? description.substring(0, 100) + "..." : description
  const ShowMoreIcon = showMore ? ChevronUp : ChevronDown

  return (
    <article className={`
      relative flex flex-col h-full shadow-sm rounded-md border transition-all duration-300 bg-surface overflow-hidden
      ${isCompleted 
        ? "border-slate-200 dark:border-slate-800 opacity-60" 
        : "border-slate-200 dark:border-slate-800 hover:border-brand/50 hover:shadow-md"}
    `}>
      
      <header className={`
        p-4 flex justify-between items-center
        ${isCompleted ? "bg-surface-muted" : "bg-brand text-white"}
      `}>
        <h3 className={`font-semibold truncate text-text-inverse ${isCompleted ? "line-through opacity-80 text-text-main" : ""}`}>
          {title}
        </h3>
        <span className="text-xs font-mono shrink-0 bg-white/20 px-2 py-0.5 rounded">
          {estimatedTime}m
        </span>
      </header>

      <div className="p-4 grow space-y-2 flex flex-col">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand">
            {category}
          </span>
          {isOverdue && <AlertCircle className="w-4 h-4 text-failure animate-pulse" />}
        </div>
        <p className="text-sm text-text-main leading-relaxed">
          {formattedDescription}
        </p>
        {isLongDesc && (
          <button 
            aria-label={showMore ? "Show More" : "Show Less"}
            className="p-1.5 rounded-md hover:bg-surface-muted transition-colors group cursor-pointer self-end"
            onClick={() => setShowMore(prev => !prev)}
          >
          <ShowMoreIcon 
            aria-hidden="true"
            className="w-5 h-5 group-hover:scale-110 transition-all"
          />
        </button>
        )}
      </div>

      <footer className="p-4 mt-auto border-t border-slate-100 dark:border-slate-800 bg-slate  rounded-b-md flex justify-between items-center">
        <div className="flex items-center gap-2 text-text-sub">
          <Clock className="w-4 h-4" />
          <time className={`text-xs font-medium ${isOverdue ? "text-failure font-bold" : ""}`}>
            {new Date(dueDate).toLocaleDateString('en-GB')}
          </time>
        </div>

        <div className="flex gap-3">
          <button 
            onClick={() => onDelete(id)}
            title="Delete Task"
            aria-label={`Delete task: ${title}`}
            className="p-1.5 rounded-md hover:bg-failure/10 transition-colors group cursor-pointer"
          >
            <Trash2
              aria-hidden="true" 
              className="w-5 h-5 text-failure/70 group-hover:text-failure group-hover:scale-110 transition-all" />
          </button>
          <button 
            onClick={() => onEdit(id)}
            title="Edit Task"
            aria-label={`Edit task: ${title}`}
            className="p-1.5 rounded-md hover:bg-info/10 transition-colors group cursor-pointer"
          >
            <Pencil
              aria-hidden="true" 
              className="w-5 h-5 text-info/70 group-hover:text-info group-hover:scale-110 transition-all" />
          </button>
          <button 
            onClick={() => setIsCompleted(id, !isCompleted)}
            title={isCompleted ? "Mark as pending" : "Mark as complete"}
            aria-label={isCompleted ? "Mark task as pending" : "Mark task as complete"}
            className="p-1.5 rounded-md hover:bg-success/10 transition-colors group cursor-pointer"
          >
            <CheckCircle 
              aria-hidden="true"
              className={`w-5 h-5 transition-all group-hover:scale-110 
                ${isCompleted ? "text-success fill-success/20" : "text-text-sub group-hover:text-success"}`} 
            />
          </button>
        </div>
      </footer>
    </article>
  );
}

interface TaskCardConnectedProps extends Task {
  setIsCompleted?: (id: number, isComplete: boolean) => void;
  onDelete?: (id: number) => void;
  onEdit?: (id: number) => void;
}
export default function TaskCardConnected(props: TaskCardConnectedProps){
  const {
    setIsCompleted,
    handleConfirmDelete,
    handleConfirmEdit
  } = useTaskContext()

  return (
    <TaskCard 
      setIsCompleted={setIsCompleted}
      onDelete={handleConfirmDelete}
      onEdit={handleConfirmEdit}
      {...props}
    />

  )
}