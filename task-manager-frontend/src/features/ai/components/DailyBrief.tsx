import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, RefreshCw, X } from "lucide-react";
import { useGetDailyBrief } from "../hooks";

const DailyBrief = () => {
  const { data: brief, isLoading, isError, refetch } = useGetDailyBrief();
  const [isOpen, setIsOpen] = useState(false);

  if (isLoading)
    return (
      <div
        className="flex items-center justify-center bg-surface dark:bg-surface-muted border border-slate-200 shadow-sm text-slate-500 w-12 h-12 rounded-full
        "
      >
        <Sparkles size={24} fill="currentColor" />
      </div>
    );
  if (isError)
    return <div className="text-red-500">Error loading brief...</div>;
  if (!brief) return null;

  return (
    <div className="relative antialiase ">
      <button
        aria-label={isOpen ? "Close daily brief" : "Open daily brief"}
        onClick={() => setIsOpen(true)}
        className={`
          flex items-center justify-center bg-surface dark:bg-surface-muted border border-slate-200 shadow-md text-brand
          transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
          hover:scale-110 hover:shadow-lg active:scale-95 mx-auto
          ${
            isOpen
              ? "opacity-0 scale-0 pointer-events-none"
              : "opacity-100 scale-100 w-12 h-12 rounded-full"
          }
        `}
      >
        <Sparkles size={24} fill="currentColor" className="animate-pulse" />
      </button>

      <div
        className={`
          bg-white border border-slate-200 shadow-sm 
          transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
          ${
            isOpen
              ? "opacity-100 scale-100 w-full translate-y-0"
              : "opacity-0 scale-95 w-full -translate-y-4 pointer-events-none absolute"
          }
          rounded-xl
        `}
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-accent" />

        <div className="card ">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-accent">
              <Sparkles size={20} fill="currentColor" />
              <h2 className="font-semibold text-text-primary text-xl">
                Daily Brief
              </h2>
            </div>

            <div className="flex gap-2">
              <button
                aria-label="Reload daily brief"
                onClick={() => refetch()}
                className="p-2 text-text-primary hover:text-brand cursor-pointer bg-brand/10 rounded-full hover:brightness-125"
              >
                <RefreshCw size={20} />
              </button>
              <button
                aria-label="Close daily brief"
                onClick={() => setIsOpen(false)}
                className="p-2 text-text-primary hover:text-failure cursor-pointer bg-failure/10 rounded-full hover:brightness-125"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div
            className={`${isOpen ? "h-full" : "max-h-0 overflow-clip"} daily-brief `}
          >
            <ReactMarkdown
              allowedElements={["h1", "h2", "h3", "h4", "p", "strong"]}
            >
              {brief}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyBrief;
