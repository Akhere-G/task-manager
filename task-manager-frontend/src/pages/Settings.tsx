import React, { useEffect } from "react";
import { User, Shield, Moon, Save, Palette } from "lucide-react";
import { useTheme } from "../features/users/ThemeContext";

const THEMES = [
  { id: "", name: "Default (Indigo)" },
  { id: "theme-lavender", name: "Soft Lavender" },
  { id: "theme-ocean", name: "Ocean Blue" },
  { id: "theme-arctic", name: "Arctic Cyan" },
  { id: "theme-emerald", name: "Emerald Forest" },
  { id: "theme-amber", name: "Amber Sunset" },
  { id: "theme-rose", name: "Rose Gold" },
  { id: "theme-bubblegum", name: "Bubblegum Pink" },
  { id: "theme-chocolate-pistachio", name: "Cocoa Pistachio" },
  { id: "theme-timber-dark", name: "Timber" },
  { id: "theme-slate", name: "Professional Slate" },
  { id: "theme-midnight", name: "Midnight Blue" },
  { id: "theme-sandstone", name: "Sandstone" },
  { id: "theme-vaporwave", name: "Vaporwave" },
  { id: "theme-volcanic", name: "Volcanic Dark" },
  { id: "theme-radioactive", name: "Radioactive" },
  { id: "theme-cosmic", name: "Cosmic" },
  { id: "theme-midnight-gold", name: "Midnight Gold" },
];

export default function SettingsPage() {
  const { darkMode, theme, toggleDarkMode, setTheme } = useTheme();

  useEffect(() => {
    // Handle Dark Mode
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }

    // Handle Colour Themes (removing all potential theme classes first)
    THEMES.forEach((t) => {
      if (t.id) {
        document.documentElement.classList.remove(t.id);
      }
    });

    // Apply the selected theme
    if (theme) {
      document.documentElement.classList.add(theme);
    }

    localStorage.setItem("app-theme", theme);
  }, [theme, darkMode]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-text-main mb-8">
        Account Settings
      </h1>

      {/* Settings Grid */}
      <div className="grid gap-6">
        {/* Theme Selection Section */}
        <SettingsCard
          icon={<Palette className="text-brand" />}
          title="Theme Selection"
        >
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            {THEMES.map((t) => (
              <button
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

        {/* Preferences Section */}
        <SettingsCard icon={<Moon className="text-brand" />} title="Appearance">
          <div className="flex items-center justify-between">
            <span className="text-text-main font-medium">Dark Mode</span>
            <button
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
      </div>
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
    <div className="card p-6 border border-slate-200 dark:border-slate-800 transition-colors duration-200">
      <div className="flex items-center gap-3 mb-4 border-b border-slate-100 dark:border-slate-800 pb-3">
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
      <button className="btn-secondary">Change Password</button>
    </SettingsCard>

    <div className="mt-8 flex justify-end">
      <button className="btn-primary flex items-center gap-2">
        <Save size={18} /> Save Changes
      </button>
    </div>
  </div>;
}
