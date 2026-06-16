import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatDate } from "date-fns";
import useGetStats from "../hooks/useGetStats";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import ChartToolTip from "./ChartToolTip";
import type { WeekOverviewData } from "../api";

export default function WeekOverviewChart() {
  const {
    data: weekOverview,
    isLoading,
    isError,
  } = useGetStats<WeekOverviewData[]>((data) => data.weekOverview);

  const breakpoint = useBreakpoint();
  const isMobile = ["xs", "sm"].includes(breakpoint);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error="Could not load data." />;
  if (!weekOverview || weekOverview.length === 0) {
    return <EmptyState searchMessage="No tasks this week. Time to relax!" />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={weekOverview}
        margin={{ top: 0, right: -40, left: -0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="var(--color-border-light)"
        />
        <XAxis
          dataKey="date"
          tickFormatter={(d) =>
            formatDate(new Date(d), isMobile ? "EEE" : "EEE d MMM")
          }
          tick={{ fill: "var(--color-text-main)", fontSize: 12 }}
        />
        <YAxis
          yAxisId="left"
          orientation="left"
          stroke="var(--color-blue-500)"
          tick={{ fill: "var(--color-text-main)", fontSize: 12 }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          stroke="var(--color-brand)"
          tick={{ fill: "var(--color-text-main)", fontSize: 12 }}
        />

        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              const tasks = payload[1]?.value ?? 0;
              const totalHours = payload[0]?.value ?? 0;

              const hours = Math.floor(totalHours);
              const minutes = ((totalHours - hours) * 60).toFixed();
              const valueStr = `${hours}hr ${minutes}min`;

              return (
                <ChartToolTip
                  title={{
                    name: formatDate(new Date(label as string), "EEE do MMM"),
                  }}
                  series={[
                    {
                      name: "Time:",
                      value: valueStr,
                      fill: "bg-blue-400",
                    },
                    {
                      name: "Tasks:",
                      value: tasks,
                      fill: "bg-brand",
                    },
                  ]}
                />
              );
            }
            return null;
          }}
        />

        <Legend verticalAlign="top" height={36} />

        <Line
          yAxisId="left"
          type="monotone"
          dataKey="totalHours"
          name="Hours"
          stroke="var(--color-blue-400)"
          strokeWidth={2.5}
          dot={{ r: 4, fill: "var(--color-blue-400)" }}
          activeDot={{ r: 6 }}
        />
        <Bar
          yAxisId="right"
          dataKey="count"
          name="Tasks"
          fill="var(--color-brand)"
          radius={[4, 4, 0, 0]}
          barSize="8%"
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
