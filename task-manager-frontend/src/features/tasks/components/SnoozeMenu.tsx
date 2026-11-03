import { useState } from "react";
import { AlarmClockPlus } from "lucide-react";
import type { SnoozePreset, Task } from "../types";

interface SnoozeMenuProps {
  task: Task;
  onSnooze: (preset: SnoozePreset, day?: string) => void;
}

const DAY_PRESETS = [
  { preset: "tomorrow", label: "Tomorrow" },
  { preset: "weekend", label: "This weekend" },
  { preset: "next_week", label: "Next week" },
] as const;

const itemClass =
  "w-full rounded px-3 py-1.5 text-left text-sm hover:bg-brand/10";

export default function SnoozeMenu({ task, onSnooze }: SnoozeMenuProps) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState("");

  const choose = (preset: SnoozePreset, chosenDay?: string) => {
    setOpen(false);
    onSnooze(preset, chosenDay);
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Snooze task: ${task.title}`}
        title="Snooze task"
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-md hover:bg-slate-500/10 transition-colors cursor-pointer"
      >
        <AlarmClockPlus aria-hidden className="w-5 h-5 text-slate-500/70" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-10 mb-1 flex w-52 flex-col gap-1 rounded-md border border-surface bg-surface p-2 shadow-lg"
        >
          {DAY_PRESETS.map(({ preset, label }) => (
            <button
              key={preset}
              role="menuitem"
              className={itemClass}
              onClick={() => choose(preset)}
            >
              {label}
            </button>
          ))}
          <label className="flex flex-col gap-1 px-3 text-sm">
            Pick date
            <input
              type="date"
              value={day}
              onChange={(e) => {
                setDay(e.target.value);
                if (e.target.value) choose("date", e.target.value);
              }}
            />
          </label>
          {task.repeatBy && (
            <button
              role="menuitem"
              className={itemClass}
              onClick={() => choose("next_occurrence")}
            >
              Next occurrence
            </button>
          )}
        </div>
      )}
    </div>
  );
}
