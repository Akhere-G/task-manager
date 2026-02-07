import { categories } from "./types"

export const categoryOptions = [
  { name: "All", value: "" }, 
  ...categories
]

export const taskDurationOptions = [
  { name: "All", value: "" },
  { name: "Long Tasks", value: "long_tasks" },
  { name: "Short Tasks", value: "short_tasks" },
]

export const completedTasksOptions = [
  { name: "All", value: "" },
  { name: "Completed", value: "true" },
  { name: "Pending", value: "false" },
]

export const dueDateOptions = [
  { name: "All", value: "" },
  { name: "Today", value: "today" },
  { name: "This Week", value: "this_week" },
  { name: "This Month", value: "this_month" },
  { name: "Overdue", value: "overdue" },
]

export const sortByOptions = [
  { name: "Due Date", value: "due_date"},
  { name: "Created At", value: "created_at"},
  { name: "Title", value: "title"},
  { name: "Estimated Time", value: "estimated_time"},
  { name: "", value: ""},
]

export const isAscOptions = [
  { name: "Ascending", value: "asc" },
  { name: "Descending", value: "desc" },
]