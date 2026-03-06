import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import useGetStats from "../hooks/useGetStats";
import type { OverdueDistributionData } from "../../../services/api";

export default function OverdueDistributionChart() {
  const {
    data: overdueDistribution,
    isLoading,
    isError,
  } = useGetStats<OverdueDistributionData[]>(
    (data) => data.overdueDistribution,
  );
  const breakpoint = useBreakpoint();

  function formatDaysOverdue(daysOverdue: string) {
    if (["xs", "sm", "md"].includes(breakpoint)) {
      return daysOverdue
        .replace(" Days", "D")
        .replace(" Week", "W")
        .replace(" Month", "M");
    }
    return daysOverdue;
  }
  const colors = ["#ffba08", "#f48c06", "#dc2f02", "#9d0208", "#6a040f"];
  if (isLoading) return <LoadingState />;
  if (isError)
    return <ErrorState error={isError ? "Could not load data." : ""} />;

  const chartData = overdueDistribution?.map((d, i) => ({
    ...d,
    fill: colors[i],
    daysOverdue: formatDaysOverdue(d.daysOverdue),
  }));

  if (chartData && chartData.length === 0) {
    return <EmptyState searchMessage="No overdue tasks. Hooraay!" />;
  }

  return (
    <ResponsiveContainer>
      <BarChart
        data={chartData}
        margin={{ top: 0, right: 0, bottom: 0, left: -30 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="category"
          dataKey="daysOverdue"
          tick={{ fill: "var(--color-text-sub)" }}
        />
        <YAxis type="number" dataKey="count" />
        <Bar dataKey="count" />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border-light)",
            borderRadius: "12px",
            color: "var(--color-text-main)",
            boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
          }}
          cursor={{ fill: "transparent" }}
          labelFormatter={(str) => `${str} overdue`}
          formatter={(str) => [str, "Tasks"]}
          itemStyle={{
            color: "var(--color-text-main)",
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
