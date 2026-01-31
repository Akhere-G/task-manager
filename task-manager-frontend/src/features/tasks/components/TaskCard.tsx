import type { Task } from "../types";

export default function TaskCard({title, category, description, isCompleted, dueDate, estimatedTime }: Task){
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