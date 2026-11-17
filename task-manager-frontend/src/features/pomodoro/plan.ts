import { LONG_REST_EVERY } from "./constants";
import type { Phase, PomodoroSettings } from "./types";

const PHASE_SETTING = {
  work: "workMinutes",
  rest: "restMinutes",
  longRest: "longRestMinutes",
} as const satisfies Record<Phase, keyof PomodoroSettings>;

export const sessionCount = (taskMinutes: number, workMinutes: number) =>
  Math.max(1, Math.ceil(taskMinutes / workMinutes));

export const restPhaseAfter = (session: number): Phase =>
  session % LONG_REST_EVERY === 0 ? "longRest" : "rest";

export const phaseSeconds = (phase: Phase, settings: PomodoroSettings) =>
  settings[PHASE_SETTING[phase]] * 60;

export function formatClock(seconds: number) {
  const absolute = Math.abs(seconds);
  const minutes = Math.floor(absolute / 60);
  const rest = absolute % 60;
  const sign = seconds < 0 ? "-" : "";
  return `${sign}${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
