import { categories } from "./types";

export const categoryOptions = [{ name: "All", value: "" }, ...categories];

export const taskDurationOptions = [
  { name: "All", value: "" },
  { name: "Long Tasks", value: "long_tasks" },
  { name: "Short Tasks", value: "short_tasks" },
];

export const completedTasksOptions = [
  { name: "All", value: "all" },
  { name: "Completed", value: "true" },
  { name: "Pending", value: "false" },
];

export const dueDateOptions = [
  { name: "All", value: "" },
  { name: "Today", value: "today" },
  { name: "This Week", value: "this_week" },
  { name: "This Month", value: "this_month" },
  { name: "Overdue", value: "overdue" },
];

export const sortByOptions = [
  { name: "Start Date", value: "start_at" },
  { name: "Created At", value: "created_at" },
  { name: "Title", value: "title" },
  { name: "Duration", value: "duration" },
];

export const isAscOptions = [
  { name: "Ascending", value: "asc" },
  { name: "Descending", value: "desc" },
];

export const categoryColours: Record<string, string> = {
  work: "#6366f1", // Indigo-600
  home: "#8b5cf6", // Violet-500
  chores: "#94a3b8", // Slategray
  "life-admin": "#0ea5e9", // Sky-500
  health: "#10b981", // Emerald-500
  "self-care": "#ec4899", // Pink-500
  social: "#f59e0b", // Amber-500
  hobbies: "#f43f5e", // Rose-500
  learning: "#3b82f6", // Blue-600
  finance: "#059669", // Green-600
  general: "#64748b", // Slate-500
};

export const calendarColoursLight: Record<string, string> = {
  work: "#4f46e5", // Indigo-600
  home: "#7c3aed", // Violet-600
  chores: "#64748b", // Slate-500
  "life-admin": "#0369a1", // Sky-700
  health: "#047857", // Emerald-700
  "self-care": "#be185d", // Pink-700
  social: "#b45309", // Amber-700
  hobbies: "#be123c", // Rose-700
  learning: "#1d4ed8", // Blue-700
  finance: "#15803d", // Green-700
  general: "#475569", // Slate-600
};

export const calendarColoursDark: Record<string, string> = {
  work: "#4338ca", // Indigo-700
  home: "#6d28d9", // Violet-700
  chores: "#475569", // Slate-600
  "life-admin": "#075985", // Sky-800
  health: "#065f46", // Emerald-800
  "self-care": "#9d174d", // Pink-800
  social: "#92400e", // Amber-800
  hobbies: "#9f1239", // Rose-800
  learning: "#1e40af", // Blue-800
  finance: "#166534", // Green-800
  general: "#334155", // Slate-700
};
