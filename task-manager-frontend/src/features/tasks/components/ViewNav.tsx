import { TASK_VIEWS, type TaskView, type TaskViewCounts } from "../views";

interface ViewNavProps {
  view: TaskView;
  counts?: TaskViewCounts;
  onSelect: (view: TaskView) => void;
}

const baseClass =
  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-1.5 text-sm";

export default function ViewNav({ view, counts, onSelect }: ViewNavProps) {
  return (
    <nav aria-label="Task views" className="flex flex-col gap-1">
      {TASK_VIEWS.map(({ value, label }) => {
        const count = value === "all" ? undefined : counts?.[value];
        const selected = value === view;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect(value)}
            className={`${baseClass} ${selected ? "bg-brand text-white" : "bg-surface text-text-main hover:bg-brand/20"}`}
          >
            <span>{label}</span>
            {count !== undefined && (
              <span
                aria-label={`${count} tasks`}
                className="text-xs opacity-80"
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
