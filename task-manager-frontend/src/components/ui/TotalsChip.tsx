import { formatTaskTotals } from "../../features/tasks/utils";

interface TotalsChipProps {
  total: number;
  totalMinutes: number;
}

export default function TotalsChip({ total, totalMinutes }: TotalsChipProps) {
  return (
    <span className="rounded-full border bg-surface px-2 py-0.5 text-[11px] font-medium text-text-sub">
      {formatTaskTotals(total, totalMinutes)}
    </span>
  );
}
