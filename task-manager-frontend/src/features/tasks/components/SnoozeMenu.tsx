import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (e: PointerEvent) => {
      const target = e.target as Node;
      if (menu.current?.contains(target) || button.current?.contains(target))
        return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [open]);

  // Cards clip their overflow, so the menu is drawn on the page instead.
  const toggle = () => {
    setAnchor(button.current?.getBoundingClientRect() ?? null);
    setOpen(!open);
  };

  const choose = (preset: SnoozePreset, chosenDay?: string) => {
    setOpen(false);
    onSnooze(preset, chosenDay);
  };

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Snooze task: ${task.title}`}
        title="Snooze task"
        onClick={toggle}
        className="p-1.5 rounded-md hover:bg-slate-500/10 transition-colors cursor-pointer"
      >
        <AlarmClockPlus aria-hidden className="w-5 h-5 text-slate-500/70" />
      </button>
      {open &&
        anchor &&
        createPortal(
          <div
            ref={menu}
            role="menu"
            style={{
              bottom: window.innerHeight - anchor.top + 4,
              right: window.innerWidth - anchor.right,
            }}
            className="fixed z-110 flex w-52 flex-col gap-1 rounded-md border border-surface bg-surface p-2 shadow-lg"
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
            <div className="flex flex-col gap-1 px-3 text-sm">
              <label className="flex flex-col gap-1">
                Pick date
                <input
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                />
              </label>
              <button
                role="menuitem"
                disabled={!day}
                className={`${itemClass} text-center font-medium disabled:opacity-50 disabled:hover:bg-transparent`}
                onClick={() => choose("date", day)}
              >
                Snooze to date
              </button>
            </div>
            {task.repeatBy && (
              <button
                role="menuitem"
                className={itemClass}
                onClick={() => choose("next_occurrence")}
              >
                Next occurrence
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
