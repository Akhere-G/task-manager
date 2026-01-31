import { useState } from "react";
import { Link } from "react-router-dom";

type Props = {
  links: { path: string; title: string }[];
  currentPath: string;
};

export default function Header({ links, currentPath }: Props) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

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
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-surface z-50 transform transition-transform duration-300 ease-in-out md:hidden shadow-2xl
        ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
      `}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <span className="font-bold text-brand text-xl">Menu</span>
          <button onClick={closeSidebar} className="text-text-main text-2xl" aria-label="Close menu">&times;</button>
        </div>
        <nav className="p-4">
          <ul className="flex flex-col gap-2">
            {links.map(({ title, path }) => (
              <li key={path}>
                <Link 
                  to={path} 
                  onClick={closeSidebar}
                  className={`block p-3 rounded-lg font-medium transition-colors ${
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
        </nav>
      </aside>

      {/* Main Header Container */}
      <header className="bg-surface border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Hamburger Button (Mobile Only) */}
            <button 
              onClick={toggleSidebar}
              className="md:hidden p-2 -ml-2 text-text-main hover:bg-surface-muted rounded-lg transition-colors"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <h1 className="text-2xl font-black text-brand tracking-tight">
              Task<span className="text-text-main">Flow</span>
            </h1>
          </div>
          
          {/* Desktop Navigation (Hidden on Mobile) */}
          <nav className="hidden md:block">
            <ul className="flex gap-8">
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
          </nav>
        </div>
      </header>
    </>
  );
}