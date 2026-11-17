import { useEffect, useState } from "react";
import {
  hasStarted,
  initialSession,
  isRunning,
  loadSession,
  pause,
  remainingSeconds,
  resetPhase,
  resume,
  saveSession,
  startNextSession,
  startRest,
  type SessionState,
} from "./session";
import type { PomodoroSettings } from "./types";

const TICK_MS = 250;

export function usePomodoroSession(taskId: number, settings: PomodoroSettings) {
  const [state, setState] = useState(
    () => loadSession(taskId) ?? initialSession(settings),
  );
  const [now, setNow] = useState(() => Date.now());
  const running = isRunning(state);

  useEffect(() => {
    saveSession(taskId, state);
  }, [taskId, state]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, [running]);

  const apply = (
    transition: (current: SessionState, at: number) => SessionState,
  ) => {
    const at = Date.now();
    setNow(at);
    setState((current) => transition(current, at));
  };

  const remaining = remainingSeconds(state, now);

  return {
    state,
    remaining,
    isRunning: running,
    hasStarted: hasStarted(state, now),
    isDue: remaining <= 0,
    toggle: () =>
      apply((current, at) =>
        isRunning(current) ? pause(current, at) : resume(current, at),
      ),
    reset: () => apply((current) => resetPhase(current)),
    finishFocus: () => apply((current, at) => startRest(current, settings, at)),
    startNext: () =>
      apply((current, at) => startNextSession(current, settings, at)),
  };
}
