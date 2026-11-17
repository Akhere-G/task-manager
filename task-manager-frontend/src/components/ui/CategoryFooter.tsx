interface CategoryFooterProps {
  shown: number;
  total: number;
  /** What follows the count, e.g. "tasks in Urgent". */
  label?: string;
  className?: string;
}

export default function CategoryFooter({
  shown,
  total,
  label = "",
  className = "",
}: CategoryFooterProps) {
  const remaining = total - shown;
  return (
    <p
      className={`flex justify-between gap-2 text-[11px] text-text-sub ${className}`}
    >
      <span>
        Showing {shown} of {total} {label}
      </span>
      {remaining > 0 && <span>Scroll for {remaining} more ↓</span>}
    </p>
  );
}
