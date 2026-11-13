import type { Priority, Task } from "../types";
import TaskCardSmall from "./TaskCardSmall";

interface MatrixQuadrantProps {
  priority: Priority;
  title: string;
  description: string;
  tasks: Task[];
  setDraggedTask: (task: Task | null) => void;
  onDropTask: (priority: Priority) => void;
}

export default function MatrixQuadrant({
  priority,
  title,
  description,
  tasks,
  setDraggedTask,
  onDropTask,
}: MatrixQuadrantProps) {
  return (
    <section
      aria-label={title}
      className="flex min-h-40 max-h-96 flex-col gap-2 rounded-xl bg-surface p-3 max-w-screen"
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDropTask(priority)}
    >
      <header>
        <h2 className="font-semibold text-text-main">
          P{priority} · {title} ({tasks.length})
        </h2>
        <p className="text-xs text-text-sub">{description}</p>
      </header>
      <div className="flex min-h-0 flex-col gap-2 overflow-y-auto">
        {tasks.map((task) => (
          <div key={task.id} className="h-24 shrink-0 [&>*]:h-full">
            <TaskCardSmall {...task} setDraggedEvent={setDraggedTask} />
          </div>
        ))}
      </div>
    </section>
  );
}
