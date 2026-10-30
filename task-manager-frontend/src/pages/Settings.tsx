import React from "react";
import { Moon, Palette, Database } from "lucide-react";
import { useTheme } from "../features/users/ThemeContext";
import { taskService } from "../features/tasks/api";
import type { Task } from "../features/tasks/types";
import { trackEvent } from "../services/analytics";
import { toCsv } from "../utils/csv";
import { formatRepeatDays } from "../features/tasks/recurrence";

const EXPORT_PAGE_SIZE = 200;

export default function SettingsPage() {
  const { darkMode, theme, toggleDarkMode, setTheme, THEMES } = useTheme();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isError, setIsError] = React.useState(false);

  const downloadTasks = (tasks: Task[]) => {
    const headers = [
      "Title",
      "Category",
      "Description",
      "Start At",
      "End At",
      "Repeat By",
      "Repeat Until",
      "Repeat Interval",
      "Repeat Days",
      "Repeat Time Zone",
      "Is Completed",
      "Completed At",
      "Created At",
    ];

    const getCompletedAt = (
      completedAt: string | null,
      endAt: string,
      isCompleted: boolean,
    ) => {
      if (isCompleted && !completedAt) {
        return endAt;
      }
      return completedAt ? completedAt : "";
    };
    const taskData = tasks.map(
      ({
        title,
        category,
        description,
        startAt,
        endAt,
        repeatBy,
        repeatUntil,
        repeatInterval,
        repeatDays,
        repeatTimezone,
        isCompleted,
        completedAt,
        createdAt,
      }) => [
        title,
        category,
        description,
        startAt,
        endAt,
        repeatBy ?? "",
        repeatUntil ? repeatUntil : "",
        repeatBy ? (repeatInterval ?? 1) : "",
        formatRepeatDays(repeatBy, repeatDays),
        repeatBy ? (repeatTimezone ?? "") : "",
        String(isCompleted),
        getCompletedAt(completedAt, endAt, isCompleted),
        createdAt,
      ],
    );

    const csvContent = toCsv([headers, ...taskData]);

    const blob = new Blob(["\ufeff", csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "tasks_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const fetchAllTasks = async () => {
    const tasks: Task[] = [];
    let page = 1;
    let totalPages = 1;
    do {
      const params = new URLSearchParams({
        is_completed: "all",
        sort_by: "created_at",
        order: "asc",
        project_repeating: "false",
        page: String(page),
        limit: String(EXPORT_PAGE_SIZE),
      });
      const result = await taskService.getAll(params);
      tasks.push(...result.tasks);
      totalPages = result.totalPages;
      page += 1;
    } while (page <= totalPages);
    return tasks;
  };

  const exportData = async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const tasks = await fetchAllTasks();
      downloadTasks(tasks);
      trackEvent("tasks_exported_csv", { row_count: tasks.length });
    } catch (err) {
      console.error(err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="grid gap-6">
      <header className="card ">
        <h1 className="text-3xl font-bold text-text-main">Settings</h1>
        <p className="text-text-sub">Your preferences</p>
      </header>

      <SettingsCard
        icon={<Palette className="text-brand" />}
        title="Theme Selection"
      >
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {THEMES.map((t) => (
            <button
              aria-label={`Set Theme to ${t.name}`}
              key={t.name}
              onClick={() => setTheme(t.id)}
              className={`py-2 rounded-lg border text-sm transition-all cursor-pointer ${
                theme === t.id
                  ? "border-brand bg-brand/10 font-bold text-brand"
                  : "border-slate-200 hover:border-brand/50 dark:border-slate-700"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </SettingsCard>
      <SettingsCard icon={<Moon className="text-brand" />} title="Appearance">
        <div className="flex items-center justify-between">
          <span className="text-text-main font-medium">Dark Mode</span>
          <button
            aria-label="Toggle dark mode"
            onClick={toggleDarkMode}
            className={`w-12 h-6 rounded-full transition-colors cursor-pointer relative ${
              darkMode ? "bg-brand" : "bg-slate-300 dark:bg-slate-600"
            }`}
          >
            <span
              className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${
                darkMode ? "translate-x-6" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </SettingsCard>
      <SettingsCard icon={<Database className="text-brand" />} title="Data">
        <div>
          <div className="flex gap-4 items-center justify-between">
            <h4>Download your task data</h4>
            <button
              aria-label="Export data"
              onClick={exportData}
              disabled={isLoading}
              className={isLoading ? "btn-primary-disabled" : "btn-primary"}
            >
              Export
            </button>
          </div>
          {isError && (
            <p className="mt-2 text-failure bg-failure/10 p-1 pl-4 rounded-md border-l-failure border-l-4">
              Could not export data.
            </p>
          )}
        </div>
      </SettingsCard>
    </div>
  );
}

function SettingsCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-4 border-b border-slate-500 dark:border-slate-400 pb-3">
        {icon}
        <h3 className="text-lg font-bold text-text-main">{title}</h3>
      </div>
      {children}
    </div>
  );
}
