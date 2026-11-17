import { Loader2 } from "lucide-react";
import { useRef, type ReactNode } from "react";

import { InfiniteSentinel } from "./InfiniteSentinel";

interface ScrollFeedProps {
  isLoading: boolean;
  isEmpty: boolean;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  emptyMessage: ReactNode;
  className?: string;
  children: ReactNode;
}

export default function ScrollFeed({
  isLoading,
  isEmpty,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  emptyMessage,
  className = "",
  children,
}: ScrollFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={scrollRef} className={`overflow-y-auto ${className}`}>
      {children}
      {!isLoading && isEmpty && emptyMessage}
      {isLoading && (
        <p className="p-3 text-center text-xs text-text-sub">Loading…</p>
      )}
      <InfiniteSentinel
        onVisible={fetchNextPage}
        disabled={!hasNextPage || isFetchingNextPage}
        scrollRef={scrollRef}
      />
      {isFetchingNextPage && (
        <Loader2
          aria-label="Loading more tasks"
          className="mx-auto my-2 animate-spin text-text-sub"
          size={16}
        />
      )}
    </div>
  );
}
