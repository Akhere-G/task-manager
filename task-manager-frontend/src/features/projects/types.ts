export interface Project {
  id: number;
  name: string;
  colour: string;
  parentId: number | null;
  position: number;
}

export type ProjectInput = Pick<Project, "name"> &
  Partial<Pick<Project, "colour" | "parentId">>;

export const MAX_PROJECT_DEPTH = 3;
export const DEFAULT_PROJECT_COLOUR = "#64748b";
export const INBOX_NAME = "Inbox";
