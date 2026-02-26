import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Sparkles, RefreshCw, X } from "lucide-react";
import { useGetDailyBrief } from "../hooks";

const DailyBrief = () => {
  const { data: brief, isLoading, isError, refetch } = useGetDailyBrief();
  const [isOpen, setIsOpen] = useState(true);

  if (isLoading)
    return (
      <div className="w-full h-32 bg-slate-100 animate-pulse rounded-xl" />
    );
  if (isError)
    return <div className="text-red-500">Error loading brief...</div>;
  if (!brief) return null;

  return (
    <div className="relative antialiase">
      <button
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
          bg-white border border-slate-200 shadow-sm overflow-hidden
          transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
          ${
            isOpen
              ? "opacity-100 scale-100 w-full translate-y-0"
              : "opacity-0 scale-95 w-full -translate-y-4 pointer-events-none absolute"
          }
          rounded-xl
        `}
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-[#615fff]" />

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-[#615fff]">
              <Sparkles size={20} fill="currentColor" />
              <h2 className="font-semibold text-slate-800">Daily Brief</h2>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => refetch()}
                className="p-1 text-slate-400 hover:text-[#615fff]"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-red-500"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="prose prose-slate prose-sm max-w-none prose-p:text-slate-600">
            <ReactMarkdown>{brief}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyBrief;
