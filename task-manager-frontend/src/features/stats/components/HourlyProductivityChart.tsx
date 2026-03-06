import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import type { HourlyProductivityData } from "../../../services/api";
import useGetStats from "../hooks/useGetStats";
import { useBreakpoint } from "../../../hooks/useBreakpoint";

export default function HourlyProductivityChart() {
  const { data, isLoading, isError } = useGetStats<HourlyProductivityData[]>(
    (stats) => stats.hourlyProductivity,
  );
  const breakpoint = useBreakpoint();
  const isSmallScreen = ["xs", "sm", "md"].includes(breakpoint);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error="Could not load data" />;

  const totalTasks = data?.reduce((acc, curr) => acc + curr.count, 0) ?? 0;
  const hasNoData = totalTasks === 0;

  if (hasNoData) return <EmptyState searchMessage="No tasks completed yet." />;

  const hourlyProductivity = data?.map((d) => ({
    ...d,
    fill: "var(--color-brand)",
  }));
  return (
    <ResponsiveContainer>
      <BarChart
        data={hourlyProductivity}
        margin={{ top: 0, right: 0, bottom: 0, left: -30 }}
      >
        <XAxis
          dataKey="hour"
          tick={{ fill: "var(--color-text-main)", fontSize: "12px" }}
          tickFormatter={(value) => {
            let suffix = value >= 12 ? "pm" : "am";
            suffix = isSmallScreen ? "" : suffix;
            let hour = value === 12 ? 12 : value % 12;
            hour = isSmallScreen ? value : hour;
            return `${hour} ${suffix}`;
          }}
        />
        <YAxis
          dataKey="count"
          tick={{ fill: "var(--color-text-main)", fontSize: "12px" }}
        />
        <Bar
          dataKey="count"
          radius={[4, 4, 0, 0]}
          activeBar={{ style: { filter: "brightness(120%)" } }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--color-surface)",
            borderColor: "var(--color-border-light)",
            borderRadius: "12px",
            color: "var(--color-text-main)",
            boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
          }}
          labelFormatter={(value) => {
            const suffix = value >= 12 ? "pm" : "am";
            const hour = value === 12 ? 12 : value % 12;
            return `Hour: ${hour} ${suffix}`;
          }}
          cursor={{ fill: "transparent" }}
          itemStyle={{
            color: "var(--color-text-main)",
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
