interface ShowingRangeProps {
  currentPage: number;
  perPage: number;
  totalItems: number;
  isCompleted: string;
}

const STATUS_WORDS: Record<string, string> = {
  false: "pending ",
  true: "completed ",
};

export default function ShowingRange({
  currentPage,
  perPage,
  totalItems,
  isCompleted,
}: ShowingRangeProps) {
  const from = (currentPage - 1) * perPage + 1;
  const to = Math.min(currentPage * perPage, totalItems);
  return (
    <p className="text-xs text-text-sub">
      Showing {from}–{to} of {totalItems} {STATUS_WORDS[isCompleted] ?? ""}
      tasks
    </p>
  );
}
