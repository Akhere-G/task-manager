import type { Task } from "../features/tasks/types";

const tasks: Task[] = [
  {
    id: 1,
    title: "Finish Flask API integration",
    description: "Connect the task service to the actual Python backend and test the CORS headers.",
    category: "Development",
    isCompleted: false,
    dueDate: "2026-02-05",
    estimatedTime: 120,
    createdAt: "2026-01-30T10:00:00Z"
  },
  {
    id: 2,
    title: "Review project structure",
    description: "Ensure the feature-based folder organisation is consistent across the whole app.",
    category: "Planning",
    isCompleted: true,
    dueDate: "2026-01-31",
    estimatedTime: 45,
    createdAt: "2026-01-28T14:30:00Z"
  },
  {
    id: 3,
    title: "Design TaskCard UI",
    description: null, // Testing nullable description
    category: "Design",
    isCompleted: false,
    dueDate: "2026-02-01",
    estimatedTime: 60,
    createdAt: "2026-01-31T09:15:00Z"
  },
  {
    id: 4,
    title: "Fix Dark Mode contrast issues",
    description: "Check the 'surface-muted' colours in dark mode to ensure high accessibility.",
    category: "Bug Fix",
    isCompleted: false,
    dueDate: "2026-02-02",
    estimatedTime: 30,
    createdAt: "2026-01-31T12:00:00Z"
  }
];

export default function Home() {
  return (
    /* bg-canvas handles the main background transition */
    <section className="flex flex-col gap-6 min-h-full">
      <header>
        <h1 className="text-3xl font-bold text-text-main transition-colors">Tasks</h1>
        <p className="text-text-sub">Manage your daily goals.</p>
      </header>

      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {tasks.map(task => (
          <li key={task.id}>
            <TaskCard {...task}/>
          </li>
        ))}
      </ul>
    </section>
  )
}

function TaskCard({title, category, description, isCompleted, dueDate, estimatedTime }: Task){
  return (
    <article className={`
      relative flex flex-col h-full shadow-sm rounded-xl border transition-all duration-300 bg-surface
      ${isCompleted 
        ? "border-slate-200 dark:border-slate-800 opacity-60" 
        : "border-slate-200 dark:border-slate-800 hover:border-brand/50 hover:shadow-md"}
    `}>
      
      {/* Header with dynamic brand background */}
      <header className={`
        p-4 flex justify-between items-center rounded-t-xl
        ${isCompleted ? "bg-surface-muted" : "bg-brand text-white"}
      `}>
        <p className={`font-semibold truncate ${isCompleted ? "line-through text-text-sub" : ""}`}>
          {title}
        </p>
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono">{estimatedTime}m</span>
          <input 
            type="checkbox" 
            readOnly 
            checked={isCompleted}
            className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand accent-brand cursor-not-allowed"
          />
        </div>
      </header>

      {/* Body Section */}
      <div className="p-4 grow space-y-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-brand">
          {category}
        </span>
        <p className="text-sm text-text-main leading-relaxed">
          {description || <span className="italic text-text-sub text-xs">No description provided.</span>}
        </p>
      </div>

      {/* Footer Section */}
      <footer className="p-4 mt-auto border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 rounded-b-xl">
        <p className="text-xs font-medium text-text-sub">
          Due: {new Date(dueDate).toLocaleDateString('en-GB')}
        </p>
      </footer>
    </article>
  )
}