import { useState } from "react";

import { menuItemClass } from "../../../components/ui/menuStyles";
import type { SnoozePreset } from "../types";

interface SnoozeOptionsProps {
  hasNextOccurrence: boolean;
  onChoose: (preset: SnoozePreset, day?: string) => void;
}

const DAY_PRESETS = [
  { preset: "tomorrow", label: "Tomorrow" },
  { preset: "weekend", label: "This weekend" },
  { preset: "next_week", label: "Next week" },
] as const;

export default function SnoozeOptions({
  hasNextOccurrence,
  onChoose,
}: SnoozeOptionsProps) {
  const [day, setDay] = useState("");

  return (
    <>
      {DAY_PRESETS.map(({ preset, label }) => (
        <button
          key={preset}
          type="button"
          role="menuitem"
          className={menuItemClass}
          onClick={() => onChoose(preset)}
        >
          {label}
        </button>
      ))}
      <div className="flex flex-col gap-1 px-3 text-sm">
        <label className="flex flex-col gap-1">
          Pick date
          <input
            type="date"
            value={day}
            onChange={(event) => setDay(event.target.value)}
          />
        </label>
        <button
          type="button"
          role="menuitem"
          disabled={!day}
          className={`${menuItemClass} text-center font-medium hover:bg-transparent`}
          onClick={() => onChoose("date", day)}
        >
          Snooze to date
        </button>
      </div>
      {hasNextOccurrence && (
        <button
          type="button"
          role="menuitem"
          className={menuItemClass}
          onClick={() => onChoose("next_occurrence")}
        >
          Next occurrence
        </button>
      )}
    </>
  );
}
