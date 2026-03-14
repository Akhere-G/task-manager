import { useState } from "react";
import type { Task } from "../types";
import {
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Pencil,
  ChevronDown,
  ChevronUp,
  Play,
  Sparkles,
  Repeat,
} from "lucide-react";
import { PopupModes, useTaskContext } from "../../../context/TaskContext";
import { useNavigate } from "react-router-dom";
import { formatDateRange, formatDateRelative } from "../utils";

interface TaskCardProps extends Task {
  titleIcon?: React.ReactNode;
  setIsCompleted: (id: number, isComplete: boolean) => void;
  onDelete: (task: Task) => void;
  onEdit: (task: Task) => void;
  showDelete?: boolean;
  showEdit?: boolean;
  showPomodoro?: boolean;
  showSetIsComplete?: boolean;
  showDecompose?: boolean;
  fullDescription?: boolean;
}

function TaskCard({
  titleIcon,
  setIsCompleted,
  onDelete,
  onEdit,
  showDelete = true,
  showEdit = true,
  showPomodoro = true,
  showSetIsComplete = true,
  showDecompose = true,
  fullDescription = false,
  ...task
}: TaskCardProps) {
  const {
    id,
    seriesId,
    isGhost,
    title,
    category,
    description,
    isCompleted,
    startAt,
    endAt,
    isRepeating,
    repeatBy,
    repeatUntil,
  } = task;
  const [showMore, setShowMore] = useState(false);
  const navigate = useNavigate();

  const isOverdue = !isCompleted && new Date(endAt) < new Date();

  const desc = description || "";
  const maxDescriptionLength = 100;
  const isLongDesc = desc.length > maxDescriptionLength;
  const formattedDescription =
    isLongDesc && !showMore && !fullDescription
      ? desc.substring(0, 100) + "..."
      : desc;
  const ShowMoreIcon = showMore ? ChevronUp : ChevronDown;

  const endDate = new Date(endAt);
  const startDate = new Date(startAt);
  const duration = (
    (endDate.getTime() - startDate.getTime()) /
    60000
  ).toFixed();

  const dateStr = formatDateRange(startAt, endAt);

  return (
    <article
      className={`
      relative flex flex-col h-full shadow-sm rounded-md border transition-all duration-300 bg-surface overflow-hidden
      ${
        isCompleted
          ? "border-slate-200 dark:border-slate-800 opacity-60"
          : "border-slate-200 dark:border-slate-800 hover:border-brand/50 hover:shadow-md"
      }
    `}
    >
      <header
        className={`p-4 flex justify-between items-center ${isCompleted ? "bg-surface-muted" : "bg-brand text-white"}`}
      >
        <h3
          className={`flex gap-2 font-semibold truncate text-text-inverse ${isCompleted ? "line-through opacity-80 text-text-main" : ""}`}
        >
          {titleIcon}
          <span className="truncate">{title}</span>
        </h3>
        <span className="text-xs font-mono shrink-0 bg-white/20 px-2 py-0.5 rounded">
          {duration}m
        </span>
      </header>

      <div className="p-4 pb-0 grow space-y-2 flex flex-col">
        <div className="flex justify-between items-start">
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand">
            {category?.replace("-", " ")}
          </span>
          {isOverdue && (
            <AlertCircle className="w-4 h-4 text-failure animate-pulse" />
          )}
        </div>
        <p className="text-sm text-text-main leading-relaxed m-0">
          {formattedDescription}
        </p>
        {isLongDesc && !fullDescription && (
          <button
            aria-label={showMore ? "Show More" : "Show Less"}
            className="p-1.5 rounded-md hover:bg-surface-muted transition-colors group cursor-pointer self-end"
            onClick={() => setShowMore((prev) => !prev)}
          >
            <ShowMoreIcon
              aria-hidden="true"
              className="w-5 h-5 group-hover:scale-110 transition-all"
            />
          </button>
        )}
        {isRepeating && (
          <div className="flex gap-2 items-center justify-end text-xs text-text-sub ">
            <Repeat className="w-4 h-4" />
            <p className="uppercase tracking-wide ">
              {repeatBy}
              {repeatUntil && (
                <span> until {formatDateRelative(repeatUntil)}</span>
              )}
            </p>
          </div>
        )}
      </div>

      <footer className="p-4 pt-2 mt-auto border-t border-slate-100 dark:border-slate-800 bg-slate items-end rounded-b-md flex justify-between gap-0.5 flex-col xl:flex-row">
        <div className="flex items-center gap-2 text-text-sub tracking-wide pr-1.25">
          <Clock className="w-4 h-4" />
          <time
            className={`text-xs font-medium ${isOverdue ? "text-failure font-bold" : ""}`}
          >
            {dateStr}
          </time>
        </div>

        <div className="flex gap-1">
          {showDelete && (
            <button
              onClick={() =>
                onDelete(isGhost ? { ...task, id: seriesId } : task)
              }
              title="Delete Task"
              aria-label={`Delete task: ${title}`}
              className="p-1.5 rounded-md hover:bg-failure/10 transition-colors group cursor-pointer"
            >
              <Trash2
                aria-hidden="true"
                className="w-5 h-5 text-failure/70 group-hover:text-failure group-hover:scale-110 transition-all"
              />
            </button>
          )}

          {showEdit && (
            <button
              onClick={() => onEdit(isGhost ? { ...task, id: seriesId } : task)}
              title="Edit Task"
              aria-label={`Edit task: ${title}`}
              className="p-1.5 rounded-md hover:bg-info/10 transition-colors group cursor-pointer"
            >
              <Pencil
                aria-hidden="true"
                className="w-5 h-5 text-info/70 group-hover:text-info group-hover:scale-110 transition-all"
              />
            </button>
          )}
          {!isCompleted && showPomodoro && (
            <button
              onClick={() => navigate(`/pomodoro/${isGhost ? seriesId : id}`)}
              title="Start Task"
              aria-label={`Start task: ${title}`}
              className="p-1.5 rounded-md hover:bg-success/10 transition-colors group cursor-pointer"
            >
              <Play
                aria-hidden="true"
                className="w-5 h-5 text-success/70 group-hover:text-success group-hover:scale-110 transition-all"
              />
            </button>
          )}
          {showSetIsComplete && (
            <button
              onClick={() =>
                setIsCompleted(isGhost ? seriesId : id, !isCompleted)
              }
              title={isCompleted ? "Mark as pending" : "Mark as complete"}
              aria-label={
                isCompleted ? "Mark task as pending" : "Mark task as complete"
              }
              className="p-1.5 rounded-md hover:bg-success/10 transition-colors group cursor-pointer"
            >
              <CheckCircle
                aria-hidden="true"
                className={`w-5 h-5 transition-all group-hover:scale-110 
                ${isCompleted ? "text-success fill-success/20" : "text-text-sub group-hover:text-success"}`}
              />
            </button>
          )}
          {!isCompleted && showDecompose && (
            <button
              onClick={() => navigate(`/breakdown/${isGhost ? seriesId : id}`)}
              title="Break down Task"
              aria-label={`Break down task: ${title}`}
              className="p-1.5 rounded-md hover:bg-brand/10 transition-colors group cursor-pointer"
            >
              <Sparkles
                aria-hidden="true"
                className="w-5 h-5 text-brand/70 group-hover:text-brand group-hover:scale-110 transition-all"
              />
            </button>
          )}
        </div>
      </footer>
    </article>
  );
}

interface TaskCardConnectedProps extends Task {
  titleIcon?: React.ReactNode;
  setIsCompleted?: (id: number, isCompleted: boolean) => void;
  onDelete?: (task: Task) => void;
  onEdit?: (task: Task) => void;
  showDelete?: boolean;
  showEdit?: boolean;
  showPomodoro?: boolean;
  showSetIsComplete?: boolean;
  showDecompose?: boolean;
  fullDescription?: boolean;
}
export default function TaskCardConnected(props: TaskCardConnectedProps) {
  const { setIsCompleted, openPopup } = useTaskContext();

  return (
    <TaskCard
      setIsCompleted={setIsCompleted}
      onDelete={(task) => openPopup(task, PopupModes.Delete)}
      onEdit={(task) => openPopup(task, PopupModes.Edit)}
      {...props}
    />
  );
}
