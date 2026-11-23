import { useNavigate, useParams } from "react-router-dom";
import useGetTask from "../features/tasks/hooks/useGetTask";
import { EmptyState, ErrorState, LoadingState } from "../components/ui";
import { isAxiosError } from "axios";
import { Clock, Repeat } from "lucide-react";
import { useEffect } from "react";
import {
  formatDateRange,
  formatDateRelative,
  taskMinutes,
} from "../features/tasks/utils";
import { describeRecurrence } from "../features/tasks/recurrence";
import useSetIsCompleted from "../features/tasks/hooks/useSetIsCompleted";
import ProjectLabel from "../features/projects/ProjectLabel";
import { PomodoroTimer } from "../features/pomodoro/components/PomodoroTimer";
import { sessionCount } from "../features/pomodoro/plan";
import { clearSession } from "../features/pomodoro/session";
import { usePomodoroSettings } from "../features/pomodoro/usePomodoroSettings";

const DEFAULT_FOCUS_MINUTES = 25;

export default function Pomodoro() {
  const { settings, updateSettings } = usePomodoroSettings();

  const navigate = useNavigate();

  const { taskId } = useParams();

  const {
    data: task,
    isLoading,
    isError,
    error,
  } = useGetTask(Number(taskId ?? -1));
  const { setIsCompleted } = useSetIsCompleted();

  const status = isAxiosError(error) ? error.status : 0;

  const alreadyCompleted = Boolean(task?.isCompleted);
  useEffect(() => {
    if (alreadyCompleted) navigate(-1);
  }, [alreadyCompleted, navigate]);

  if (isLoading) return <LoadingState />;
  if (isError && status !== 404)
    return <ErrorState error="Could not load details" />;

  if (!task) return <EmptyState searchMessage={`This task doesn't exist`} />;

  const {
    id,
    title,
    projectId,
    description,
    isCompleted,
    startAt,
    endAt,
    isRepeating,
    repeatUntil,
  } = task;

  if (isCompleted) return null;
  const isOverdue = !isCompleted && !!endAt && new Date(endAt) < new Date();

  const duration = taskMinutes(task) || DEFAULT_FOCUS_MINUTES;

  const dateStr = formatDateRange(startAt, endAt);

  const completeTask = () => {
    clearSession(id);
    setIsCompleted(id, true, task);
    navigate(-1);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="card">
        <h1 className="text-3xl text-bold transition-colors">Pomodoro Mode</h1>
        <p className="text-text-sub">
          Boost focus and complete long tasks easier.
        </p>
      </header>
      <div className="flex gap-6 flex-col lg:flex-row">
        <div className="card overflow-hidden lg:flex-1/2 p-0 flex flex-col gap-2">
          <header className="p-4 flex justify-between items-center bg-brand text-text-main">
            <h2 className="flex gap-2 font-semibold truncate text-text-inverse ">
              <span className="truncate">{title}</span>
            </h2>
            <span className="text-xs font-mono shrink-0 bg-white/20 px-2 py-0.5 rounded">
              {duration}m
            </span>
          </header>
          <div className="px-4 pb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand">
              <ProjectLabel projectId={projectId} />
            </span>
            <p>{description}</p>
          </div>
          {isRepeating && (
            <div className="flex gap-2 items-center justify-end text-sm text-text-sub ">
              <Repeat className="w-4 h-4" />
              <p className="uppercase tracking-widest text-[12px] pr-4">
                {describeRecurrence(task)}
                {repeatUntil && (
                  <span> until {formatDateRelative(repeatUntil)}</span>
                )}
              </p>
            </div>
          )}
          <footer className="p-4 mt-auto border-t border-slate-100 dark:border-slate-800 bg-slate  rounded-b-md flex justify-between items-center">
            <div className="flex items-center gap-2 text-text-sub">
              <Clock className="w-4 h-4" />
              <time
                className={`text-xs font-medium ${isOverdue ? "text-failure font-bold" : ""}`}
              >
                {dateStr}
              </time>
            </div>
          </footer>
        </div>
        <div className="card lg:flex-1/2 flex flex-col gap-4">
          <h2 className="text-2xl">Start Pomodoro Mode</h2>
          <PomodoroTimer
            key={id}
            taskId={id}
            taskTitle={title}
            settings={settings}
            totalSessions={sessionCount(
              taskMinutes(task),
              settings.workMinutes,
            )}
            onSettingsChange={updateSettings}
            onCompleteTask={completeTask}
          />
        </div>
      </div>
    </div>
  );
}
