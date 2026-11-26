import { useState } from "react";

import { useToast } from "../../../context/ToastContext";
import { getApiErrorMessage } from "../../../utils/errors";
import PrioritySuggestions from "../../ai/components/PrioritySuggestions";
import { matrixQuadrants } from "../constants";
import useUpdateTask from "../hooks/useUpdateTask";
import type { TaskFilters } from "../taskParams";
import type { Priority, Task } from "../types";
import { taskTargetId } from "../utils";
import type { TaskView } from "../views";
import MatrixQuadrant from "./MatrixQuadrant";

interface EisenhowerMatrixProps {
  filters: TaskFilters;
  search: string;
  view: TaskView;
}

export default function EisenhowerMatrix({
  filters,
  search,
  view,
}: EisenhowerMatrixProps) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const { mutate: updateTask } = useUpdateTask();
  const { showError } = useToast();

  const moveDraggedTaskTo = (priority: Priority) => {
    if (draggedTask && draggedTask.priority !== priority) {
      updateTask(
        {
          id: taskTargetId(draggedTask),
          newTaskData: { priority },
          preview: { priority },
        },
        {
          onError: (error) =>
            showError(
              getApiErrorMessage(error, "Could not change the priority"),
            ),
        },
      );
    }
    setDraggedTask(null);
  };

  return (
    <div className="flex max-w-mn flex-col gap-3">
      <PrioritySuggestions />
      <div className="hidden grid-cols-2 gap-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-text-sub lg:grid">
        <p>
          <span className="text-failure">● Urgent</span> — Requires immediate
          focus
        </p>
        <p>
          <span className="text-text-main">● Not urgent</span> — Plan
          intentionally or eliminate
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {matrixQuadrants.map((quadrant) => (
          <MatrixQuadrant
            key={quadrant.priority}
            {...quadrant}
            filters={filters}
            search={search}
            view={view}
            setDraggedTask={setDraggedTask}
            onDropTask={moveDraggedTaskTo}
          />
        ))}
      </div>
    </div>
  );
}
