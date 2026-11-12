import { useEffect, useState } from "react";
import { PanelLeft, X } from "lucide-react";
import ProjectNav from "../../projects/ProjectNav";
import type { TaskView, TaskViewCounts } from "../views";
import ViewNav from "./ViewNav";

interface TasksSidebarProps {
  view: TaskView;
  counts?: TaskViewCounts;
  project: string;
  onSelectView: (view: TaskView) => void;
  onSelectProject: (projectId: string) => void;
}

const heading = "px-1 text-xs font-bold uppercase tracking-wide text-text-sub";

/** Always visible on wide screens; a drawer opened from a button on narrow ones. */
export default function TasksSidebar({
  view,
  counts,
  project,
  onSelectView,
  onSelectProject,
}: TasksSidebarProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const choose =
    <T,>(action: (value: T) => void) =>
    (value: T) => {
      action(value);
      setOpen(false);
    };

  return (
    <aside className="md:w-52 md:shrink-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="mx-3 flex items-center gap-2 rounded-lg bg-surface px-3 py-1.5 text-sm md:hidden"
      >
        <PanelLeft size={16} aria-hidden />
        Views / projects
      </button>

      {open && (
        <div
          aria-hidden
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <div
        role={open ? "dialog" : undefined}
        aria-label="Views / projects"
        className={`${
          open ? "flex" : "hidden"
        } fixed inset-y-0 left-0 z-40 w-72 flex-col gap-4 overflow-y-auto bg-canvas p-4 shadow-xl md:static md:z-auto md:flex md:w-auto md:bg-transparent md:p-0 md:shadow-none`}
      >
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setOpen(false)}
          className="self-end md:hidden"
        >
          <X aria-hidden />
        </button>
        <section className="flex flex-col gap-1">
          <h2 className={heading}>Views</h2>
          <ViewNav
            view={view}
            counts={counts}
            onSelect={choose(onSelectView)}
          />
        </section>
        <section className="flex flex-col gap-1">
          <h2 className={heading}>Projects</h2>
          <ProjectNav selected={project} onSelect={choose(onSelectProject)} />
        </section>
      </div>
    </aside>
  );
}
