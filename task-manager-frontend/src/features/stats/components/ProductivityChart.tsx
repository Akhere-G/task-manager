import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import useGetStats from "../hooks/useGetStats";
import type { ProductivityData } from "../../../services/api";

export default function ProductivityChart() {
  const {
    data: productivity,
    isLoading,
    isError,
  } = useGetStats<ProductivityData[]>((data) => data.productivity);

  const hasData = productivity && productivity.some((d) => d.tasks > 0);

  if (isLoading)
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingState />
      </div>
    );

  if (isError)
    return (
      <div className="flex justify-center items-center h-full">
        <ErrorState error={isError ? "Could not load data" : ""} />
      </div>
    );
  if (productivity && !hasData) {
    return <EmptyState searchMessage="No tasks recently completed." />;
  }

  const chartData = productivity?.slice(-30);

  return (
    productivity && (
      <ResponsiveContainer maxHeight={300}>
        <LineChart
          data={chartData}
          margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
        >
          {/* Grid lines using your surface-muted variable */}
          <CartesianGrid
            strokeDasharray="3 3"
            vertical={false}
            stroke="var(--color-surface-muted)"
          />

          <XAxis
            dataKey="date"
            tick={{ fill: "var(--color-text-sub)", fontSize: "12px" }}
            axisLine={{ stroke: "var(--color-surface-muted)" }}
            tickLine={false}
            tickFormatter={(str) => {
              const date = new Date(str);
              return date.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
              });
            }}
            minTickGap={30}
          />

          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--color-text-sub)", fontSize: "12px" }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-surface-muted)",
              borderRadius: "12px",
              color: "var(--color-text-main)",
              boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
            }}
            labelStyle={{
              color: "var(--color-text-main)",
              marginBottom: "4px",
            }}
            labelFormatter={(str) => {
              const date = new Date(str);
              return date.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              });
            }}
          />

          <Legend
            verticalAlign="top"
            height={40}
            formatter={(value) => (
              <span
                style={{
                  color: "var(--color-text-main)",
                  fontSize: "14px",
                  fontWeight: 500,
                }}
              >
                {value}
              </span>
            )}
          />
          <Line
            name="Tasks completed"
            type="monotone"
            dataKey="tasks"
            stroke="var(--color-brand)"
            strokeWidth={3}
            dot={{
              r: 4,
              fill: "var(--color-brand)",
              strokeWidth: 2,
              stroke: "var(--color-surface)",
            }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    )
  );
}
