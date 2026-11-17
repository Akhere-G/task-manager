import { AlarmClockPlus } from "lucide-react";

import DropdownMenu from "../../../components/ui/DropdownMenu";
import type { SnoozePreset, Task } from "../types";
import SnoozeOptions from "./SnoozeOptions";

interface SnoozeMenuProps {
  task?: Task;
  label?: string;
  onSnooze: (preset: SnoozePreset, day?: string) => void;
}

export default function SnoozeMenu({ task, label, onSnooze }: SnoozeMenuProps) {
  return (
    <DropdownMenu
      label={label ?? `Snooze task: ${task?.title}`}
      placement="above"
      triggerClassName="p-1.5 rounded-md hover:bg-slate-500/10 transition-colors cursor-pointer"
      trigger={
        <AlarmClockPlus aria-hidden className="w-5 h-5 text-slate-500/70" />
      }
    >
      {(close) => (
        <SnoozeOptions
          hasNextOccurrence={Boolean(task?.repeatBy)}
          onChoose={(preset, day) => {
            close();
            onSnooze(preset, day);
          }}
        />
      )}
    </DropdownMenu>
  );
}
