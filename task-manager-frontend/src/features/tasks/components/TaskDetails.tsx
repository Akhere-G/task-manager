import useGetTask from "../hooks/useGetTask";
import type { Task } from "../types";
import SubtaskChecklist from "./SubtaskChecklist";
import TaskCard from "./TaskCard";

type TaskDetailsProps = Omit<
  React.ComponentProps<typeof TaskCard>,
  keyof Task
> & {
  task: Task;
};

export default function TaskDetails({ task, ...actions }: TaskDetailsProps) {
  const seriesTask = useGetTask(task.isGhost ? task.seriesId : task.id).data;
  const shown = task.isGhost ? task : (seriesTask ?? task);

  return (
    <div className="flex max-h-[85vh] flex-col gap-3 overflow-y-auto md:flex-row md:items-start">
      <div className="min-w-0 md:flex-3">
        <TaskCard {...shown} {...actions} />
      </div>
      <div className="rounded-md border border-surface bg-surface p-3 shadow-sm md:flex-2">
        <SubtaskChecklist
          parentId={seriesTask?.id ?? task.id}
          subtasks={seriesTask?.subtasks ?? []}
        />
      </div>
    </div>
  );
}
