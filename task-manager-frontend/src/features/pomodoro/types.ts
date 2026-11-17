export type Phase = "work" | "rest" | "longRest";

export interface PomodoroSettings {
  workMinutes: number;
  restMinutes: number;
  longRestMinutes: number;
}
