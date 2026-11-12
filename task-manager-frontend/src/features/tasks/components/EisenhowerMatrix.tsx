import { useState } from "react";
import PrioritySuggestions from "../../ai/components/PrioritySuggestions";
import { matrixQuadrants } from "../constants";
import useUpdateTask from "../hooks/useUpdateTask";
import type { Priority, Task } from "../types";
import { groupByPriority } from "../utils";
import MatrixQuadrant from "./MatrixQuadrant";

interface EisenhowerMatrixProps {
  tasks: Task[];
}

export default function EisenhowerMatrix({ tasks }: EisenhowerMatrixProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const { mutate: updateTask } = useUpdateTask();
  const tasksByPriority = groupByPriority(tasks);

  const moveDraggedTaskTo = (priority: Priority) => {
    if (draggedTask && draggedTask.priority !== priority) {
      updateTask({
        id: draggedTask.isGhost ? draggedTask.seriesId : draggedTask.id,
        newTaskData: { priority },
      });
    }
    setDraggedTask(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <PrioritySuggestions />
      <div className="grid gap-3 md:grid-cols-2">
        {matrixQuadrants.map((quadrant) => (
          <MatrixQuadrant
            key={quadrant.priority}
            {...quadrant}
            tasks={tasksByPriority[quadrant.priority]}
            setDraggedTask={setDraggedTask}
            onDropTask={moveDraggedTaskTo}
          />
        ))}
      </div>
    </div>
  );
}
