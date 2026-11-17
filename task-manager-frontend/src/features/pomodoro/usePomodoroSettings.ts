import { useState } from "react";
import { loadSettings, normalizeSettings, saveSettings } from "./settings";
import type { PomodoroSettings } from "./types";

export function usePomodoroSettings() {
  const [settings, setSettings] = useState(loadSettings);

  const updateSettings = (changes: Partial<PomodoroSettings>) => {
    const next = normalizeSettings({ ...settings, ...changes });
    setSettings(next);
    saveSettings(next);
  };

  return { settings, updateSettings };
}
