import { SETTING_LIMITS } from "../constants";
import type { PomodoroSettings } from "../types";
import { MinutesField } from "./MinutesField";

const FIELDS = [
  { key: "workMinutes", label: "Focus" },
  { key: "restMinutes", label: "Rest" },
  { key: "longRestMinutes", label: "Long rest" },
] as const satisfies readonly { key: keyof PomodoroSettings; label: string }[];

interface PomodoroSettingsFormProps {
  settings: PomodoroSettings;
  onChange: (changes: Partial<PomodoroSettings>) => void;
}

export function PomodoroSettingsForm({
  settings,
  onChange,
}: PomodoroSettingsFormProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {FIELDS.map(({ key, label }) => (
          <MinutesField
            key={key}
            name={key}
            label={label}
            value={settings[key]}
            min={SETTING_LIMITS[key].min}
            max={SETTING_LIMITS[key].max}
            onCommit={(minutes) => onChange({ [key]: minutes })}
          />
        ))}
      </div>
      <p className="text-xs text-text-sub">
        A long rest replaces the rest after every 4th session. Changes apply
        from the next block.
      </p>
    </div>
  );
}
