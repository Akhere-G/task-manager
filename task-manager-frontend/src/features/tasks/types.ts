export type Priority = 1 | 2 | 3 | 4;
export const DEFAULT_PRIORITY: Priority = 4;

export type RepeatFrequency = "daily" | "weekly" | "monthly" | "yearly";
export interface Task {
  id: number;
  title: string;
  description: string | null;
  projectId: number | null;
  labelIds: number[];
  priority: Priority;
  isCompleted: boolean;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
  completedAt: string | null;
  isRepeating?: boolean | null;
  repeatBy?: string | null;
  repeatUntil?: string | null;
  repeatInterval?: number | null;
  repeatDays?: (number | string)[] | null;
  repeatTimezone?: string | null;
  isGhost: boolean;
  seriesId: number;
}

export interface TrashedTask extends Task {
  deletedAt: string;
  purgeAt: string;
}

export type CreateTaskInput = Omit<
  Task,
  | "id"
  | "createdAt"
  | "isCompleted"
  | "completedAt"
  | "isGhost"
  | "seriesId"
  | "labelIds"
> & { labelIds?: number[] };
