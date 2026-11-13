export const ON_DROP_OPTIONS = [
  { value: "nothing", label: "Do nothing" },
  { value: "complete", label: "Mark complete" },
  { value: "uncomplete", label: "Mark incomplete" },
  { value: "delete", label: "Move to trash" },
] as const;

export type OnDrop = (typeof ON_DROP_OPTIONS)[number]["value"];

export const isOnDrop = (value: string): value is OnDrop =>
  ON_DROP_OPTIONS.some((option) => option.value === value);

export interface ProjectColumn {
  id: number;
  projectId: number;
  name: string;
  status: string;
  colour: string;
  onDrop: OnDrop;
  position: number;
}

export type ColumnInput = Pick<ProjectColumn, "name"> &
  Partial<Pick<ProjectColumn, "status" | "colour" | "onDrop">>;

export interface BoardMoveInput {
  columnId: number | null;
  afterId: number | null;
  beforeId: number | null;
}

export const DEFAULT_COLUMN_COLOUR = "#64748b";
