import { useNavigate, useParams } from "react-router-dom";
import useGetTask from "../features/tasks/hooks/useGetTask";
import { EmptyState, ErrorState, LoadingState, Popup } from "../components/ui";
import { isAxiosError } from "axios";
import { Clock, Pause, Play } from "lucide-react";
import { useState } from "react";
import { CountdownCircleTimer } from "react-countdown-circle-timer";
import { useTaskContext } from "../context/TaskContext";

export default function Pomodoro() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  const navigate = useNavigate();

  const { taskId } = useParams();

  const { data: task, isLoading, isError, error } = useGetTask(taskId ?? "");
  const { setIsCompleted } = useTaskContext();

  const status = isAxiosError(error) ? error.status : 0;

  const toggleIsPlaying = () => setIsPlaying((prev) => !prev);

  if (isLoading) return <LoadingState />;
  if (isError && status !== 404)
    return <ErrorState error="Could not load details" />;

  if (!task) return <EmptyState searchMessage={`This task doesn't exist`} />;

  const {
    id,
    title,
    category,
    description,
    isCompleted,
    dueDate,
    estimatedTime,
  } = task;

  const isOverdue = !isCompleted && new Date(dueDate) < new Date();

  const formatStr = (str: string) =>
    (str[0].toUpperCase() + str.slice(1)).replace("-", " ");

  const TimerButton = isPlaying ? Pause : Play;

  return (
    <div className="flex flex-col gap-6">
      <header className="card">
        <h1 className="text-3xl text-bold transition-colors">Pomodoro Mode</h1>
        <p className="text-text-sub">
          Boost focus and complete long tasks easier.
        </p>
      </header>
      <div className="flex gap-6 flex-col md:flex-row">
        <div className="card overflow-hidden flex-1/2 p-0 flex flex-col gap-2">
          <header className="p-4 bg-brand text-white">
            <h2 className="text-2xl">{title}</h2>
            <p className="text-text-sub">{formatStr(category)}</p>
          </header>
          <div className="px-4 pb-4">
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand">
              {category}
            </span>
            <p>{description}</p>
          </div>
          <footer className="p-4 mt-auto border-t border-slate-100 dark:border-slate-800 bg-slate  rounded-b-md flex justify-between items-center">
            <div className="flex items-center gap-2 text-text-sub">
              <Clock className="w-4 h-4" />
              <time
                className={`text-xs font-medium ${isOverdue ? "text-failure font-bold" : ""}`}
              >
                {new Date(dueDate).toLocaleDateString("en-GB")}
              </time>
            </div>
          </footer>
        </div>
        <div className="card flex-1/2 flex flex-col gap-4">
          <h2 className="text-2xl">Start Pomodoro Mode</h2>
          <div className="flex items-center justify-center h-max">
            <CountdownCircleTimer
              colors={["var(--color-brand)"]}
              isPlaying={isPlaying}
              duration={estimatedTime * 60}
              onComplete={() => {
                setShowCompleteModal(true);
                setIsPlaying(false);
              }}
            >
              {({ remainingTime }) => {
                const minutes = Math.floor(remainingTime / 60)
                  .toString()
                  .padStart(2, "0");
                const seconds = (remainingTime % 60)
                  .toString()
                  .padStart(2, "0");

                return (
                  <div className="flex flex-col items-center pt-8 gap-4">
                    <button
                      className="p-1.5 group cursor-pointer"
                      aria-label={isPlaying ? "Pause Timer" : "Play Timer"}
                    >
                      <TimerButton
                        onClick={toggleIsPlaying}
                        className="text-brand group-hover:brightness-150 transition-all"
                        width={40}
                        height={40}
                        aria-hidden
                      />
                    </button>
                    <p>
                      {minutes}:{seconds}
                    </p>
                  </div>
                );
              }}
            </CountdownCircleTimer>
            {showCompleteModal && (
              <Popup
                close={() => setShowCompleteModal(false)}
                title={`Complete task: ${title}?`}
                handleConfirm={() => {
                  setIsCompleted(id, true);
                  navigate("/");
                }}
                actionButtonVariant="primary"
              >
                <div>Time&apos;s up! Complete task {title}? </div>
              </Popup>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
