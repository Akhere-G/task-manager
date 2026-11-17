import { DEFAULT_SETTINGS, SETTING_LIMITS } from "./constants";
import { readJson, writeJson } from "./storage";
import type { PomodoroSettings } from "./types";

const SETTINGS_KEY = "pomodoro-settings";

const settingKeys = [
  "workMinutes",
  "restMinutes",
  "longRestMinutes",
] as const satisfies readonly (keyof PomodoroSettings)[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export const clampSetting = (key: keyof PomodoroSettings, value: number) => {
  const { min, max } = SETTING_LIMITS[key];
  return Math.min(max, Math.max(min, Math.round(value)));
};

export function normalizeSettings(value: unknown): PomodoroSettings {
  const source: Record<string, unknown> = isRecord(value) ? value : {};
  const normalized = { ...DEFAULT_SETTINGS };
  for (const key of settingKeys) {
    const entry = source[key];
    if (typeof entry === "number" && Number.isFinite(entry)) {
      normalized[key] = clampSetting(key, entry);
    }
  }
  return normalized;
}

export const loadSettings = () => normalizeSettings(readJson(SETTINGS_KEY));

export const saveSettings = (settings: PomodoroSettings) =>
  writeJson(SETTINGS_KEY, settings);
