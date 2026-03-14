export type RepeatFrequency = "daily" | "weekly" | "monthly" | "yearly";
export interface Task {
  id: number;
  title: string;
  description: string | null;
  category: string;
  isCompleted: boolean;
  startAt: string;
  endAt: string;
  createdAt: string;
  completedAt: string | null;
  isRepeating?: boolean | null;
  repeatBy?: string | null;
  repeatUntil?: string | null;
  isGhost: boolean;
  seriesId: number;
}

export type CreateTaskInput = Omit<
  Task,
  "id" | "createdAt" | "isCompleted" | "completedAt" | "isGhost" | "seriesId"
>;
type Option = { name: string; value: string };

export const categories: readonly Option[] = [
  { name: "Work", value: "work" },
  { name: "Home", value: "home" },
  { name: "Chores", value: "chores" },
  { name: "Life Admin", value: "life-admin" },
  { name: "Health", value: "health" },
  { name: "Self-Care", value: "self-care" },
  { name: "Social", value: "social" },
  { name: "Hobbies", value: "hobbies" },
  { name: "Learning", value: "learning" },
  { name: "Finance", value: "finance" },
  { name: "General", value: "general" },
];
