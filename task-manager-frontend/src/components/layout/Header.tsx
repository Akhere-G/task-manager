import { Menu, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

type Props = {
  links: { path: string; title: string }[];
  currentPath: string;
  isAuthenticated: boolean;
  logout: () => void;
};

export default function Header({
  links,
  currentPath,
  isAuthenticated,
  logout,
}: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("theme") === "dark",
  );

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);
  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  return (
    <>
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={closeSidebar}
        />
      )}

      {/* Mobile Sidebar Panel */}
      <aside
        className={`
        fixed top-0 left-0 h-full w-64 bg-surface z-50 transform transition-transform duration-300 ease-in-out md:hidden shadow-2xl
        overflow-y-scroll
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}
      >
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <span className="font-bold text-brand text-xl">Menu</span>
          <button
            onClick={closeSidebar}
            className="text-text-main text-2xl"
            aria-label="Close menu"
          >
            &times;
          </button>
        </div>
        <nav className="p-4 flex flex-col">
          <ul className="flex flex-col gap-2">
            {links.map(({ title, path }) => (
              <li key={path}>
                <Link
                  to={path}
                  onClick={closeSidebar}
                  className={`block p-3 rounded-md font-medium transition-colors ${
                    currentPath === path
                      ? "bg-brand/10 text-brand"
                      : "text-text-main hover:bg-surface-muted"
                  }`}
                >
                  {title}
                </Link>
              </li>
            ))}
          </ul>
          <div className="flex gap-4 mt-4">
            {isAuthenticated && (
              <button
                className="btn-primary self-start"
                onClick={() => {
                  logout();
                  toggleSidebar();
                }}
              >
                Logout
              </button>
            )}

            <button
              onClick={toggleDarkMode}
              className="p-2 mb-3 rounded-full hover:bg-surface-muted transition-colors text-text-sub hover:text-brand"
              aria-label="Toggle dark mode"
            >
              {darkMode ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
          </div>
        </nav>
      </aside>

      {/* Main Header Container */}
      <header className="bg-surface border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Hamburger Button (Mobile Only) */}
            <button
              onClick={toggleSidebar}
              className="md:hidden p-2 -ml-2 text-text-main hover:bg-surface-muted rounded-md transition-colors"
              aria-label="Open menu"
            >
              <Menu aria-hidden="true" className="w-4 h-4" />
            </button>

            <h1 className="text-2xl font-black text-brand tracking-tight">
              Task<span className="text-text-main">Flow</span>
            </h1>
          </div>

          {/* Desktop Navigation (Hidden on Mobile) */}
          <nav className="hidden md:flex items-center gap-8">
            <ul className="flex gap-6">
              {links.map(({ title, path }) => (
                <li key={path}>
                  <Link
                    to={path}
                    className={`font-medium transition-colors ${
                      currentPath === path
                        ? "text-brand"
                        : "text-text-sub hover:text-brand"
                    }`}
                  >
                    {title}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-full hover:bg-surface-muted transition-colors text-text-sub hover:text-brand"
                aria-label="Toggle dark mode"
              >
                {darkMode ? (
                  <Sun className="w-5 h-5" />
                ) : (
                  <Moon className="w-5 h-5" />
                )}
              </button>
              {isAuthenticated && (
                <button className="btn-primary" onClick={logout}>
                  Logout
                </button>
              )}
            </div>
          </nav>
        </div>
      </header>
    </>
  );
}
