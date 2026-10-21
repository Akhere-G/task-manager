export default function DemoBanner({ onExit }: { onExit: () => void }) {
  return (
    <div
      role="status"
      className="bg-brand/10 text-text-main text-sm px-4 py-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
    >
      <span>
        You&apos;re exploring a shared demo with sample data that resets
        regularly. Please don&apos;t enter personal information.
      </span>
      <button
        aria-label="Exit demo"
        onClick={onExit}
        className="text-accent underline font-medium cursor-pointer"
      >
        Exit demo
      </button>
    </div>
  );
}
