export type Priority = 1 | 2 | 3 | 4;
export const DEFAULT_PRIORITY: Priority = 4;

export type RepeatFrequency = "daily" | "weekly" | "monthly" | "yearly";
export interface Subtask {
  id: number;
  parentId: number;
  position: number;
  title: string;
  description: string | null;
  priority: Priority;
  isCompleted: boolean;
  completedAt: string | null;
}

export type SubtaskInput = Pick<Subtask, "title"> &
  Partial<Pick<Subtask, "description" | "priority">>;

export type ReminderKind = "before" | "clock";

export interface Reminder {
  kind: ReminderKind;
  minutesBefore: number | null;
  daysBefore: number | null;
  timeOfDay: string | null;
  zoneName: string | null;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  projectId: number | null;
  labelIds: number[];
  reminders: Reminder[];
  parentId: number | null;
  position: number;
  subtaskCount: number;
  subtaskCompletedCount: number;
  subtasks?: Subtask[];
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
  | "reminders"
  | "parentId"
  | "position"
  | "subtaskCount"
  | "subtaskCompletedCount"
  | "subtasks"
> & {
  labelIds?: number[];
  /** Labels to find by name or create; added to `labelIds`. */
  labelNames?: string[];
  /** A project path ("Work / Website") to find or create; used instead of `projectId`. */
  projectName?: string;
  reminders?: Reminder[];
};

export type SnoozePreset =
  "tomorrow" | "weekend" | "next_week" | "date" | "next_occurrence";

export interface SnoozeInput {
  preset: SnoozePreset;
  day?: string;
  zoneName: string;
  isGhost?: boolean;
  previousStartAt?: string;
}
