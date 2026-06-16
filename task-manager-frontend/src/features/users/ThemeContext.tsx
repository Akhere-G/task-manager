import React, { createContext, useContext, useEffect, useState } from "react";

type ThemeContextType = {
  theme: string;
  darkMode: boolean;
  setTheme: (theme: string) => void;
  toggleDarkMode: () => void;
  THEMES: { id: string; name: string }[];
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export const THEMES = [
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
      value={{ theme, darkMode, setTheme, toggleDarkMode, THEMES }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
