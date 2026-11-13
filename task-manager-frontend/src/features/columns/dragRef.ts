export type DragRef =
  | { type: "task"; taskId: number }
  | { type: "column"; columnId: number }
  | { type: "unassigned" };

export function readDragRef(data: unknown): DragRef | null {
  if (typeof data !== "object" || data === null || !("type" in data)) {
    return null;
  }
  if (data.type === "unassigned") return { type: "unassigned" };
  if (data.type === "task" && "taskId" in data) {
    return typeof data.taskId === "number"
      ? { type: "task", taskId: data.taskId }
      : null;
  }
  if (data.type === "column" && "columnId" in data) {
    return typeof data.columnId === "number"
      ? { type: "column", columnId: data.columnId }
      : null;
  }
  return null;
}
