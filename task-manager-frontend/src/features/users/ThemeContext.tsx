import React, { createContext, useContext, useEffect, useState } from "react";

type ThemeContextType = {
  theme: string;
  darkMode: boolean;
  setTheme: (theme: string) => void;
  toggleDarkMode: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export const THEMES = [
  { id: "", name: "Default (Indigo)" },
  { id: "theme-emerald", name: "Emerald Forest" },
  { id: "theme-rose", name: "Rose Gold" },
  { id: "theme-ocean", name: "Ocean Blue" },
  { id: "theme-amber", name: "Amber Sunset" },
  { id: "theme-slate", name: "Professional Slate" },
];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<string>(
    () => localStorage.getItem("app-theme") || "",
  );
  const [darkMode, setDarkMode] = useState<boolean>(
    () => localStorage.getItem("theme") === "dark",
  );

  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  useEffect(() => {
    const root = document.documentElement;

    if (darkMode) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }

    THEMES.forEach((t) => {
      if (t.id) root.classList.remove(t.id);
    });

    if (theme) {
      root.classList.add(theme);
    }

    localStorage.setItem("app-theme", theme);
  }, [theme, darkMode]);

  return (
    <ThemeContext.Provider
      value={{ theme, darkMode, setTheme, toggleDarkMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// Custom hook to consume the context easily
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
