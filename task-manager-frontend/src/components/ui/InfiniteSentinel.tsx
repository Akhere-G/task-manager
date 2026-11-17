import { useEffect, useRef, type RefObject } from "react";

interface InfiniteSentinelProps {
  onVisible: () => void;
  disabled: boolean;
  /** The scrolling element the sentinel sits in; defaults to the viewport. */
  scrollRef?: RefObject<Element | null>;
}

export function InfiniteSentinel({
  onVisible,
  disabled,
  scrollRef,
}: InfiniteSentinelProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || disabled) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onVisible();
      },
      { root: scrollRef?.current ?? null, rootMargin: "80px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onVisible, disabled, scrollRef]);

  return <div ref={sentinelRef} aria-hidden="true" className="h-px shrink-0" />;
}
