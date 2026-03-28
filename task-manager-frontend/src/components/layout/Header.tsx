import { Menu, Moon, Sun, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

interface Link {
  path: string;
  title: string;
}

type Props = {
  links: Link[];
  accountLinks: Link[];
  currentPath: string;
  isAuthenticated: boolean;
  logout: () => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
};

export default function Header({
  links,
  accountLinks,
  currentPath,
  isAuthenticated,
  logout,
  darkMode,
  toggleDarkMode,
}: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [accountPopupOpen, setAccountPopupOpen] = useState(false);

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

  const StyleLink = ({ title, path }: Link) => {
    const classes =
      path.split("?")[0] === currentPath
        ? "bg-brand/10 text-accent md:bg-transparent"
        : "text-text-main hover:bg-surface-muted md:hover:bg-transparent hover:text-accent";
    return (
      <li key={path} className="w-full">
        <Link
          to={path}
          className={`font-medium transition-colors 
            w-full p-2  rounded block md:w-max md:p-0 ${classes}
          `}
        >
          {title}
        </Link>
      </li>
    );
  };

  const mobileLinks = [...links];

  if (isAuthenticated) {
    mobileLinks.push(...accountLinks);
  }

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
        fixed top-0 left-0 h-full w-64 bg-surface z-50 transform transition-transform duration-150 ease-in-out md:hidden shadow-2xl
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
            {mobileLinks.map((link) => (
              <StyleLink key={link.path} {...link} />
            ))}
          </ul>
          <div className="flex gap-4 mt-4">
            {isAuthenticated && (
              <button
                className="btn-primary self-start"
                aria-label="Logout"
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
            <ul className="flex gap-6 list-none">
              {links.map((link) => (
                <StyleLink key={link.path} {...link} />
              ))}
            </ul>
            {isAuthenticated && (
              <div
                tabIndex={0}
                role="button"
                aria-label="Account Menu"
                onClick={() => setAccountPopupOpen(!accountPopupOpen)}
                className="bg-brand relative rounded-full w-8 h-8 flex items-center justify-center cursor-pointer"
              >
                <User className="fill-text-inverse w-6 h-6" />
                {accountPopupOpen && isAuthenticated && (
                  <div className="flex gap-2 absolute card border border-slate-200 dark:border-slate-600 right-2 top-8 flex-col items-center cursor-default">
                    <button
                      onClick={toggleDarkMode}
                      className="p-2 rounded-full hover:bg-surface-muted transition-colors text-text-sub hover:text-brand cursor-pointer"
                      aria-label="Toggle dark mode"
                    >
                      {darkMode ? (
                        <Sun className="w-5 h-5" />
                      ) : (
                        <Moon className="w-5 h-5" />
                      )}
                    </button>

                    <ul>
                      {accountLinks.map((link) => (
                        <StyleLink key={link.path} {...link} />
                      ))}
                    </ul>
                    <button
                      aria-label="Logout"
                      className="btn-primary"
                      onClick={logout}
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>
      </header>
    </>
  );
}
