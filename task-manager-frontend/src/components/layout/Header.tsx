import { Link } from "react-router-dom";

type Props = {
  links: {path: string; title: string}[];
  currentPath: string
}

export default function Header({links, currentPath}: Props) {
  return (
    <header className="bg-surface border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-black text-brand tracking-tight">
            Task<span className="text-text-main">Flow</span>
          </h1>
          
          <nav>
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
  )
}