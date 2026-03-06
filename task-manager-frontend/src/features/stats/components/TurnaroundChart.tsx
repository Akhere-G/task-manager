import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  CartesianGrid,
} from "recharts";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import type { Turnaround } from "../../../services/api";
import useGetStats from "../hooks/useGetStats";

const WARNING_THRESHOLD = 15;

export default function TurnaroundChart() {
  const {
    data: turnaround,
    isLoading,
    isError,
  } = useGetStats<Turnaround[]>((stats) => stats.turnaround);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error="Could not load data." />;
  if (!turnaround || !turnaround.length)
    return <EmptyState searchMessage="No completed tasks." />;

  const total = turnaround.reduce((acc, curr) => acc + curr.count, 0);
  const turnaroundAverage =
    turnaround.reduce((acc, curr) => acc + curr.count * curr.daysTaken, 0) /
    (total || 1);

  const chartColor =
    turnaroundAverage <= WARNING_THRESHOLD
      ? "var(--color-success)"
      : "var(--color-failure)";

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={turnaround}
          margin={{ left: -30, top: 20, right: 0, bottom: -10 }}
        >
          <CartesianGrid
            vertical={false}
            strokeDasharray="7 7 "
            opacity="50%"
          />
          <XAxis
            dataKey="daysTaken"
            tick={{ fontSize: 12, fill: "var(--color-text-sub)" }}
            type="number"
            domain={["dataMin", "dataMax"]}
            tickCount={turnaround.length / 4}
          />
          <YAxis
            dataKey="count"
            tick={{ fontSize: 12, fill: "var(--color-text-sub)" }}
            tickCount={4}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border-light)",
              borderRadius: "12px",
              color: "var(--color-text-main)",
              boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
            }}
            labelFormatter={(days) => `${days} days takens to complete`}
            formatter={(count) => [count, "Tasks"]}
            cursor={{ stroke: chartColor, strokeWidth: 1 }}
          />
          <ReferenceLine
            x={turnaroundAverage}
            stroke={chartColor}
            strokeDasharray="3 3"
            label={{
              value: `Avg: ${turnaroundAverage.toFixed(1)}d`,
              position: "top",
              fill: chartColor,
              fontSize: 12,
              fontWeight: "bold",
            }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke={chartColor}
            strokeWidth={3}
            fill={chartColor}
            fillOpacity={0.15}
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
