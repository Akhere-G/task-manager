export type DragRef =
  { type: "task"; taskId: number } | { type: "column"; columnId: number };

export function readDragRef(data: unknown): DragRef | null {
  if (typeof data !== "object" || data === null) return null;
  if ("type" in data && data.type === "task" && "taskId" in data) {
    return typeof data.taskId === "number"
      ? { type: "task", taskId: data.taskId }
      : null;
  }
  if ("type" in data && data.type === "column" && "columnId" in data) {
    return typeof data.columnId === "number"
      ? { type: "column", columnId: data.columnId }
      : null;
  }
  return null;
}
