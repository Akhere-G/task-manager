import { useState } from "react";
import {
  REMINDER_PRESETS,
  START_OF_DAY,
  clockReminder,
  reminderKey,
  reminderLabel,
} from "../reminders";
import type { Reminder } from "../types";

interface ReminderPickerProps {
  value: Reminder[];
  onChange: (reminders: Reminder[]) => void;
}

const chipClass = (selected: boolean) =>
  `inline-flex items-center rounded-full border px-3 py-1 text-sm cursor-pointer ${
    selected
      ? "border-brand bg-brand/10 text-text-main"
      : "border-border-light text-text-sub"
  }`;

export default function ReminderPicker({
  value,
  onChange,
}: ReminderPickerProps) {
  const [time, setTime] = useState(START_OF_DAY);
  const chosen = new Set(value.map(reminderKey));
  const presetKeys = new Set(
    REMINDER_PRESETS.map((p) => reminderKey(p.reminder())),
  );
  const extras = value.filter(
    (reminder) => !presetKeys.has(reminderKey(reminder)),
  );

  const toggle = (reminder: Reminder) => {
    const key = reminderKey(reminder);
    onChange(
      chosen.has(key)
        ? value.filter((r) => reminderKey(r) !== key)
        : [...value, reminder],
    );
  };

  const addAtTime = () => {
    if (!time) return;
    const reminder = clockReminder(time);
    if (!chosen.has(reminderKey(reminder))) onChange([...value, reminder]);
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-bold text-text-main">Reminders</span>
      <div role="group" aria-label="Reminders" className="flex flex-wrap gap-2">
        {REMINDER_PRESETS.map(({ label, reminder }) => (
          <button
            key={label}
            type="button"
            aria-pressed={chosen.has(reminderKey(reminder()))}
            onClick={() => toggle(reminder())}
            className={chipClass(chosen.has(reminderKey(reminder())))}
          >
            {label}
          </button>
        ))}
        {extras.map((reminder) => (
          <button
            key={reminderKey(reminder)}
            type="button"
            aria-pressed
            aria-label={`Remove reminder: ${reminderLabel(reminder)}`}
            onClick={() => toggle(reminder)}
            className={chipClass(true)}
          >
            {reminderLabel(reminder)} ×
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-text-sub">
          At time
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <button
          type="button"
          className="btn-secondary text-sm disabled:cursor-not-allowed disabled:opacity-50"
          onClick={addAtTime}
          disabled={!time}
        >
          Add reminder
        </button>
      </div>
    </div>
  );
}
