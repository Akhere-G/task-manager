interface SubtaskProgressProps {
  done: number;
  total: number;
}

export default function SubtaskProgress({ done, total }: SubtaskProgressProps) {
  if (total === 0) return null;
  return (
    <div
      role="progressbar"
      aria-label="Subtask progress"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      className="h-2 w-full rounded-full bg-border-light overflow-hidden"
    >
      <div
        className="h-full bg-brand transition-all"
        style={{ width: `${(done / total) * 100}%` }}
      />
    </div>
  );
}
