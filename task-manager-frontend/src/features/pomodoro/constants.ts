import type { Phase, PomodoroSettings } from "./types";

export const DEFAULT_SETTINGS: PomodoroSettings = {
  workMinutes: 25,
  restMinutes: 5,
  longRestMinutes: 15,
};

export const SETTING_LIMITS = {
  workMinutes: { min: 1, max: 180 },
  restMinutes: { min: 1, max: 60 },
  longRestMinutes: { min: 1, max: 60 },
} as const satisfies Record<
  keyof PomodoroSettings,
  { min: number; max: number }
>;

export const LONG_REST_EVERY = 4;

export const PHASE_LABEL = {
  work: "Focus",
  rest: "Rest",
  longRest: "Long rest",
} as const satisfies Record<Phase, string>;
