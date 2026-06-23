import React from "react";
import { User, Shield, Moon, Save, Palette, Database } from "lucide-react";
import { useTheme } from "../features/users/ThemeContext";
import { useTasks } from "../features/tasks/hooks/useTasks";
import type { Task } from "../features/tasks/types";
import { formatInTimeZone } from "date-fns-tz";

const defaultFilters = {
  search: "",
  category: "",
  duration: "",
  isCompleted: "all",
  dueDate: "",
  sortBy: "created_at",
  order: "asc",
  currentDate: new Date().toISOString(),
};
export default function SettingsPage() {
  const { darkMode, theme, toggleDarkMode, setTheme, THEMES } = useTheme();
  const { isLoading, isError, refetch } = useTasks({
    perPage: null,
    enabled: false,
    defaultFilters,
  });

  const downloadTasks = (tasks: Task[]) => {
    const headers = [
      "Title",
      "Category",
      "Description",
      "Start At",
      "End At",
      "Repeat By",
      "Repeat Until",
      "Is Completed",
      "Completed At",
      "Created At",
    ];

    const escapeCSV = (value?: string | null) => {
      const stringValue = !value ? "" : String(value);
      if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const getCompletedAt = (
      completedAt: string | null,
      endAt: string,
      isCompleted: boolean,
    ) => {
      if (isCompleted && !completedAt) {
        return formatInTimeZone(endAt, "UTC", "yyyy-MM-dd HH:mm");
      }
      return completedAt
        ? formatInTimeZone(completedAt, "UTC", "yyyy-MM-dd HH:mm")
        : "";
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
        isCompleted,
        completedAt,
        createdAt,
      }) => [
        escapeCSV(title),
        category,
        escapeCSV(description),
        formatInTimeZone(startAt, "UTC", "yyyy-MM-dd HH:mm"),
        formatInTimeZone(endAt, "UTC", "yyyy-MM-dd HH:mm"),
        repeatBy ?? "",
        repeatUntil
          ? formatInTimeZone(repeatUntil, "UTC", "yyyy-MM-dd HH:mm")
          : "",
        String(isCompleted),
        getCompletedAt(completedAt, endAt, isCompleted),
        formatInTimeZone(createdAt, "UTC", "yyyy-MM-dd HH:mm"),
      ],
    );

    const csvContent = [headers, ...taskData]
      .map((e) => e.join(","))
      .join("\n");

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

  const exportData = async () => {
    const { data } = await refetch();
    if (data) {
      downloadTasks(data.tasks);
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

export function FutureSections() {
  {
    /* Profile Section */
  }
  <div>
    <SettingsCard icon={<User className="text-brand" />} title="Profile">
      <div className="space-y-4">
        <input
          type="text"
          placeholder="Full Name"
          className="w-full p-2 bg-surface-muted rounded-md border border-slate-200 dark:border-slate-700 text-text-main focus:outline-none focus:border-brand transition-colors"
        />
        <input
          type="email"
          placeholder="Email Address"
          className="w-full p-2 bg-surface-muted rounded-md border border-slate-200 dark:border-slate-700 text-text-main focus:outline-none focus:border-brand transition-colors"
        />
      </div>
    </SettingsCard>

    {/* Security Section */}
    <SettingsCard icon={<Shield className="text-brand" />} title="Security">
      <button aria-label="Change password" className="btn-secondary">
        Change Password
      </button>
    </SettingsCard>

    <div className="mt-8 flex justify-end">
      <button
        aria-label="Save changes"
        className="btn-primary flex items-center gap-2"
      >
        <Save size={18} /> Save Changes
      </button>
    </div>
  </div>;
}
