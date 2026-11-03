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
    <div className="flex flex-col bg-surface">
      <TaskCard {...shown} {...actions} />
      <div className="p-3">
        <SubtaskChecklist
          parentId={seriesTask?.id ?? task.id}
          subtasks={seriesTask?.subtasks ?? []}
        />
      </div>
    </div>
  );
}
