import { phaseSeconds, restPhaseAfter } from "./plan";
import { isRecord, readJson, removeKey, writeJson } from "./storage";
import type { Phase, PomodoroSettings } from "./types";

export interface SessionState {
  phase: Phase;
  session: number;
  completedSessions: number;
  durationSeconds: number;
  elapsedMs: number;
  runningSince: number | null;
}

export const initialSession = (settings: PomodoroSettings): SessionState => ({
  phase: "work",
  session: 1,
  completedSessions: 0,
  durationSeconds: phaseSeconds("work", settings),
  elapsedMs: 0,
  runningSince: null,
});

export const isRunning = (state: SessionState) => state.runningSince !== null;

export const elapsedMs = (state: SessionState, now: number) =>
  state.elapsedMs +
  (state.runningSince === null ? 0 : now - state.runningSince);

export const remainingSeconds = (state: SessionState, now: number) =>
  Math.ceil(state.durationSeconds - elapsedMs(state, now) / 1000);

export const hasStarted = (state: SessionState, now: number) =>
  isRunning(state) || elapsedMs(state, now) > 0;

export const pause = (state: SessionState, now: number): SessionState =>
  isRunning(state)
    ? { ...state, elapsedMs: elapsedMs(state, now), runningSince: null }
    : state;

export const resume = (state: SessionState, now: number): SessionState =>
  isRunning(state) ? state : { ...state, runningSince: now };

export const resetPhase = (state: SessionState): SessionState => ({
  ...state,
  elapsedMs: 0,
  runningSince: null,
});

const enterPhase = (
  phase: Phase,
  session: number,
  completedSessions: number,
  settings: PomodoroSettings,
  now: number,
): SessionState => ({
  phase,
  session,
  completedSessions,
  durationSeconds: phaseSeconds(phase, settings),
  elapsedMs: 0,
  runningSince: now,
});

/** Ends the focus block, counting it as a completed session. */
export const startRest = (
  state: SessionState,
  settings: PomodoroSettings,
  now: number,
): SessionState =>
  state.phase === "work"
    ? enterPhase(
        restPhaseAfter(state.session),
        state.session,
        state.session,
        settings,
        now,
      )
    : state;

/** Ends the rest (or skips it) and begins the next focus block. */
export const startNextSession = (
  state: SessionState,
  settings: PomodoroSettings,
  now: number,
): SessionState =>
  state.phase === "work"
    ? state
    : enterPhase(
        "work",
        state.completedSessions + 1,
        state.completedSessions,
        settings,
        now,
      );

const isPhase = (value: unknown): value is Phase =>
  value === "work" || value === "rest" || value === "longRest";

function toSessionState(value: unknown): SessionState | null {
  if (!isRecord(value)) return null;
  const {
    phase,
    session,
    completedSessions,
    durationSeconds,
    elapsedMs,
    runningSince,
  } = value;
  if (
    !isPhase(phase) ||
    typeof session !== "number" ||
    typeof completedSessions !== "number" ||
    typeof durationSeconds !== "number" ||
    typeof elapsedMs !== "number" ||
    (runningSince !== null && typeof runningSince !== "number")
  ) {
    return null;
  }
  return {
    phase,
    session,
    completedSessions,
    durationSeconds,
    elapsedMs,
    runningSince,
  };
}

const sessionKey = (taskId: number) => `pomodoro-session-${taskId}`;

export const loadSession = (taskId: number) =>
  toSessionState(readJson(sessionKey(taskId)));

export const saveSession = (taskId: number, state: SessionState) =>
  writeJson(sessionKey(taskId), state);

export const clearSession = (taskId: number) => removeKey(sessionKey(taskId));
