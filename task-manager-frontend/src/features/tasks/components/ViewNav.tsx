import { TASK_VIEWS, type TaskView, type TaskViewCounts } from "../views";

interface ViewNavProps {
  view: TaskView;
  counts?: TaskViewCounts;
  onSelect: (view: TaskView) => void;
}

const baseClass =
  "flex shrink-0 items-center justify-between gap-3 rounded-full px-3 py-1.5 text-sm md:rounded-lg md:w-full";

export default function ViewNav({ view, counts, onSelect }: ViewNavProps) {
  return (
    <nav
      aria-label="Task views"
      className="flex gap-2 overflow-x-auto px-3 md:flex-col md:gap-1 md:overflow-visible md:px-0"
    >
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
