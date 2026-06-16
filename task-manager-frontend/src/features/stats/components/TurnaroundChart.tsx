import {
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import useGetStats from "../hooks/useGetStats";
import ChartToolTip from "./ChartToolTip";
import type { Turnaround } from "../api";

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

  const hasGoodTurnaround = turnaroundAverage <= WARNING_THRESHOLD;
  const chartColor = hasGoodTurnaround
    ? "var(--color-success)"
    : "var(--color-failure)";

  const totalTasks = turnaround.reduce((acc, curr) => acc + curr.count, 0);

  if (totalTasks === 0) {
    return <EmptyState searchMessage="No tasks completed recently" />;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
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
            cursor={{
              stroke: chartColor,
              strokeWidth: 1,
              strokeDasharray: "4 4",
              fill: hasGoodTurnaround ? "#8f82" : "#f882",
            }}
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const count = payload[0].value;

                return (
                  <ChartToolTip
                    series={[
                      {
                        name: `${count} task${count !== 1 ? "s" : ""} took ${label} day${Number(label) !== 1 ? "s" : ""} to complete.`,
                      },
                    ]}
                  />
                );
              }
              return null;
            }}
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

          <Bar
            type="monotone"
            dataKey="count"
            stroke={chartColor}
            strokeWidth={3}
            fill={chartColor}
            fillOpacity={0.15}
            animationDuration={1500}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
