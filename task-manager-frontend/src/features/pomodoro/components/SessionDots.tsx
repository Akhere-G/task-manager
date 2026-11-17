interface SessionDotsProps {
  completed: number;
  total: number;
}

export function SessionDots({ completed, total }: SessionDotsProps) {
  const count = Math.max(total, completed);

  return (
    <div
      className="flex gap-2 justify-center flex-wrap"
      role="img"
      aria-label={`${completed} of ${total} sessions completed`}
    >
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`w-3 h-3 rounded-full ${i < completed ? "bg-brand" : "bg-slate-200 dark:bg-slate-700"}`}
        />
      ))}
    </div>
  );
}
