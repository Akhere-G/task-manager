import { useState } from "react";
import { Pause, Play, RotateCcw, Settings } from "lucide-react";
import { Popup } from "../../../components/ui";
import { trackEvent } from "../../../services/analytics";
import { requestNotificationPermission } from "../alerts";
import { PHASE_LABEL } from "../constants";
import { formatClock } from "../plan";
import type { PomodoroSettings } from "../types";
import { usePhaseAlerts } from "../usePhaseAlerts";
import { usePomodoroSession } from "../usePomodoroSession";
import { PomodoroSettingsForm } from "./PomodoroSettingsForm";
import { SessionDots } from "./SessionDots";
import { TimerRing, type RingTone } from "./TimerRing";

interface PomodoroTimerProps {
  taskId: number;
  taskTitle: string;
  settings: PomodoroSettings;
  totalSessions: number;
  onSettingsChange: (changes: Partial<PomodoroSettings>) => void;
  onCompleteTask: () => void;
  isCompleting: boolean;
}

export function PomodoroTimer({
  taskId,
  taskTitle,
  settings,
  totalSessions,
  onSettingsChange,
  onCompleteTask,
  isCompleting,
}: PomodoroTimerProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const session = usePomodoroSession(taskId, settings);
  const { state, remaining, isDue, isRunning } = session;

  const isWork = state.phase === "work";
  const planDone = state.completedSessions >= totalSessions;
  const phaseLabel = PHASE_LABEL[state.phase];
  const clock = formatClock(remaining);
  const tone: RingTone = isDue ? "due" : isWork ? "focus" : "rest";

  usePhaseAlerts({
    isDue,
    clock,
    phaseLabel,
    dueMessage: isWork ? "Time to take a rest." : "Ready for the next session.",
  });

  const togglePlaying = () => {
    if (!isRunning && isWork && !session.hasStarted) {
      requestNotificationPermission();
      trackEvent("pomodoro_started", {
        sessions_completed: state.completedSessions,
      });
    }
    session.toggle();
  };

  const finishFocus = () => {
    trackEvent("pomodoro_completed", { sessions_completed: state.session });
    session.finishFocus();
  };

  const PlayIcon = isRunning ? Pause : Play;
  const primaryClass = isDue ? "btn-primary" : "btn-secondary";

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between text-sm text-text-sub">
        <span>
          {isWork
            ? `Session ${state.session} of ${Math.max(totalSessions, state.session)}`
            : `${phaseLabel} after session ${state.completedSessions}`}
        </span>
        <button
          type="button"
          aria-label="Timer settings"
          aria-expanded={showSettings}
          onClick={() => setShowSettings((open) => !open)}
          className="p-1 cursor-pointer hover:text-brand"
        >
          <Settings className="w-5 h-5" aria-hidden />
        </button>
      </div>

      {showSettings && (
        <div className="w-full">
          <PomodoroSettingsForm
            settings={settings}
            onChange={onSettingsChange}
          />
        </div>
      )}

      <TimerRing
        tone={tone}
        fractionLeft={isDue ? 1 : remaining / state.durationSeconds}
      >
        <p
          className={`text-3xl font-mono ${isDue ? "text-warning" : ""}`}
          aria-live="off"
        >
          {clock}
        </p>
        <p className="text-xs text-text-sub">
          {isDue ? `${phaseLabel} overtime` : phaseLabel}
        </p>
      </TimerRing>

      <SessionDots completed={state.completedSessions} total={totalSessions} />

      <div className="flex gap-2 justify-center flex-wrap">
        <button
          type="button"
          aria-label={isRunning ? "Pause Timer" : "Play Timer"}
          onClick={togglePlaying}
          className="btn-secondary"
        >
          <PlayIcon className="w-5 h-5" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Reset timer"
          onClick={session.reset}
          className="btn-secondary"
        >
          <RotateCcw className="w-5 h-5" aria-hidden />
        </button>
        {isWork ? (
          <button type="button" onClick={finishFocus} className={primaryClass}>
            {isDue ? "Rest" : "Finish early"}
          </button>
        ) : (
          <>
            {planDone && (
              <button
                type="button"
                onClick={() => setShowCompleteModal(true)}
                className={primaryClass}
              >
                Finish task
              </button>
            )}
            <button
              type="button"
              onClick={session.startNext}
              className={planDone || !isDue ? "btn-secondary" : "btn-primary"}
            >
              {planDone
                ? "Start extra session"
                : isDue
                  ? `Start session ${state.completedSessions + 1}`
                  : "Skip rest"}
            </button>
          </>
        )}
      </div>

      {showCompleteModal && (
        <Popup
          close={() => setShowCompleteModal(false)}
          title={`Complete task: ${taskTitle}?`}
          handleConfirm={onCompleteTask}
          confirmDisabled={isCompleting}
          actionButtonVariant="primary"
        >
          <div className="flex flex-col gap-2">
            <p>
              Well done! You&apos;ve completed{" "}
              <strong>{state.completedSessions} sessions</strong>.
            </p>
            <p className="text-sm text-text-sub">
              Progress: {state.completedSessions} / {totalSessions} sessions
            </p>
            <p className="mt-4">Mark the entire task as complete now?</p>
          </div>
        </Popup>
      )}
    </div>
  );
}
