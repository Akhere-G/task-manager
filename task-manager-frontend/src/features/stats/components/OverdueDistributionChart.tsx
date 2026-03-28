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
import ChartToolTip from "./ChartToolTip";

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
    tooltipLabel: d.daysOverdue,
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
          cursor={{ fill: "var(--color-surface-muted)", opacity: 0.5 }}
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const { tooltipLabel, fill, count } = payload[0].payload;

              return (
                <ChartToolTip
                  series={[
                    {
                      name: `${count} Task${count != 1 ? "s are" : " is"}`,
                      value: `${tooltipLabel} overdue`,
                      fill,
                    },
                  ]}
                />
              );
            }
            return null;
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
