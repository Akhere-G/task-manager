import { useNavigate, useParams } from "react-router-dom";
import useGetTask from "../features/tasks/hooks/useGetTask";
import { EmptyState, ErrorState, LoadingState, Popup } from "../components/ui";
import { isAxiosError } from "axios";
import { Clock, Pause, Play } from "lucide-react";
import { useState } from "react";
import { CountdownCircleTimer } from "react-countdown-circle-timer";
import { useTaskContext } from "../context/TaskContext";

const POMODORO_DURATION = 25 * 60;

export default function Pomodoro() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  const navigate = useNavigate();

  const { taskId } = useParams();

  const {
    data: task,
    isLoading,
    isError,
    error,
  } = useGetTask(Number(taskId ?? -1));
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

  if (isCompleted) {
    navigate("/");
    return <></>;
  }
  const isOverdue = !isCompleted && new Date(dueDate) < new Date();

  const formatStr = (str: string) =>
    (str[0].toUpperCase() + str.slice(1)).replace("-", " ");

  const totalExpectedSessions = Math.ceil(estimatedTime / 25);

  const handleSessionComplete = () => {
    setIsPlaying(false);
    setSessionsCompleted((prev) => prev + 1);
    setShowCompleteModal(true);
  };

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
          <div className="flex items-center flex-col justify-center h-max">
            <CountdownCircleTimer
              key={sessionsCompleted}
              duration={POMODORO_DURATION}
              isPlaying={isPlaying}
              colors={["#615fff", "#615fff"] as [`#${string}`, `#${string}`]}
              onComplete={handleSessionComplete}
              colorsTime={[0, 0]}
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
                      onClick={toggleIsPlaying}
                    >
                      <TimerButton
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
            <div className="flex gap-2 justify-center mt-4 flex-wrap">
              {Array.from({ length: totalExpectedSessions }).map((_, i) => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full ${i < sessionsCompleted ? "bg-brand" : "bg-slate-200 dark:bg-slate-700"}`}
                />
              ))}
            </div>
            <button
              onClick={handleSessionComplete}
              className="text-xs font-bold text-accent mt-4 hover:underline"
            >
              I&apos;ve finished early!
            </button>
          </div>
        </div>
      </div>
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
          <div className="flex flex-col gap-2">
            <p>
              Well done! You&apos;ve completed{" "}
              <strong>session {sessionsCompleted}</strong>.
            </p>
            <p className="text-sm text-text-sub">
              Progress: {sessionsCompleted} / {totalExpectedSessions} sessions
            </p>
            <p className="mt-4">Mark the entire task as complete now?</p>
          </div>
        </Popup>
      )}
    </div>
  );
}
