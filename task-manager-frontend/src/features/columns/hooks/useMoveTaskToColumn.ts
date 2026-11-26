import { notifyManager } from "@tanstack/react-query";

import { predictUpdate } from "../../tasks/optimistic/predictions";
import { patchTask } from "../../tasks/optimistic/taskCache";
import useTaskWrite from "../../tasks/optimistic/useTaskWrite";
import { columnService } from "../api";
import { applyOnDrop } from "../board";
import type { BoardMoveInput, ProjectColumn } from "../types";

interface BoardMoveRequest {
  id: number;
  move: BoardMoveInput;
  column: Pick<ProjectColumn, "id" | "onDrop"> | null;
}

export default function useMoveTaskToColumn(onShown?: () => void) {
  return useTaskWrite({
    mutationFn: ({ id, move }: BoardMoveRequest) =>
      columnService.moveTask(id, move),
    apply: (queryClient, { id, move, column }) => {
      const patch = patchTask(queryClient, {
        taskId: id,
        change: (task) => {
          const moved = applyOnDrop(task, column);
          return moved && predictUpdate(moved)(task);
        },
        placement: move,
      });
      if (onShown) notifyManager.schedule(onShown);
      return patch;
    },
  });
}
