import { Link, Route, Routes, useLocation } from "react-router-dom";
import { About, AddTask, Contact, Home, Stats, TaskDetails } from "./pages";

function App() {
  const navLinks = [
    { title: "Tasks", url: "/" },
    { title: "Add Task", url: "/addtasks" },
    { title: "Stats", url: "/stats" },
    { title: "About", url: "/about" },
    { title: "Contact", url: "/contact" },
  ];

  const location = useLocation();

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="bg-surface border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-brand tracking-tight">
            Task<span className="text-text-main">Flow</span>
          </h1>
          
          <nav>
            <ul className="flex gap-8">
              {navLinks.map(({ title, url }) => (
                <li key={url}>
                  <Link 
                    to={url} 
                    className={`font-medium transition-colors ${
                      location.pathname === url 
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

      <main className="grow max-w-7xl mx-auto w-full px-6 py-8">
        <Routes>    
          <Route path="/" element={<Home />} />
          <Route path="/addtasks" element={<AddTask />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/task/:id" element={<TaskDetails />} />
          
          <Route path="*" element={<div className="text-center py-20">Page Not Found</div>} />
        </Routes>
      </main>

      <footer className="py-8 border-t border-slate-200 dark:border-slate-800 text-center text-text-sub text-sm">
        &copy; 2026 TaskFlow Manager.
      </footer>
    </div>
  );
}

export default App;