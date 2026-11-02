export const priorityOptions = [
  { name: "P1 · Urgent", value: "1" },
  { name: "P2 · High", value: "2" },
  { name: "P3 · Medium", value: "3" },
  { name: "P4 · None", value: "4" },
];

export const priorityFilterOptions = [
  { name: "All", value: "" },
  { name: "P1 only", value: "1" },
  { name: "P1 and P2", value: "1,2" },
  { name: "P1 to P3", value: "1,2,3" },
  { name: "P4 only", value: "4" },
];

export const priorityColours: Record<number, string> = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-blue-500",
};

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
  { name: "Priority", value: "priority" },
];

export const isAscOptions = [
  { name: "Ascending", value: "asc" },
  { name: "Descending", value: "desc" },
];
