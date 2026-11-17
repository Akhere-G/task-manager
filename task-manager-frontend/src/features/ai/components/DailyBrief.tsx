import { RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Popup } from "../../../components/ui";
import { trackEvent } from "../../../services/analytics";
import { useGetDailyBrief } from "../hooks";

const buttonClass =
  "flex items-center gap-1 rounded-lg bg-surface px-3 py-1.5 text-sm text-brand hover:bg-brand/20";

function BriefModal({ onClose }: { onClose: () => void }) {
  const {
    data: brief,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useGetDailyBrief();

  return (
    <Popup title="Daily Brief" close={onClose} showCloseButton={false} sleek>
      <div className="card flex flex-col gap-4 rounded-xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold text-accent">
            <Sparkles aria-hidden size={20} fill="currentColor" />
            Daily Brief
          </h2>
          <button
            type="button"
            aria-label="Reload daily brief"
            onClick={() => refetch()}
            disabled={isFetching}
            className="cursor-pointer rounded-full bg-brand/10 p-2 hover:brightness-125 disabled:opacity-50"
          >
            <RefreshCw
              aria-hidden
              size={18}
              className={isFetching ? "animate-spin" : ""}
            />
          </button>
        </div>
        {isLoading && <p className="text-text-sub">Writing your brief...</p>}
        {isError && <p className="text-failure">Error loading brief...</p>}
        {brief && (
          <div className="daily-brief">
            <ReactMarkdown
              allowedElements={["h1", "h2", "h3", "h4", "p", "strong"]}
            >
              {brief}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </Popup>
  );
}

export default function DailyBrief() {
  const { data: brief, isLoading, isError } = useGetDailyBrief();
  const [isOpen, setIsOpen] = useState(false);

  const hasNothingToShow = !isLoading && !isError && !brief;
  if (hasNothingToShow) return null;

  const open = () => {
    setIsOpen(true);
    trackEvent("ai_daily_brief_viewed");
  };

  return (
    <>
      <button
        type="button"
        aria-label="Open daily brief"
        onClick={open}
        className={buttonClass}
      >
        <Sparkles aria-hidden size={16} fill="currentColor" />
        Brief
      </button>
      {isOpen && <BriefModal onClose={() => setIsOpen(false)} />}
    </>
  );
}
