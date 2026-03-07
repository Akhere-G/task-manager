import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { statusColors } from "../constants";
import useGetStats from "../hooks/useGetStats";
import type { BacklogHealthData } from "../../../services/api";

export default function BacklogHealthChart() {
  const {
    data: backlogHealth,
    isLoading,
    isError,
  } = useGetStats<BacklogHealthData[]>((data) => data.backlogHealth);

  const total = backlogHealth?.reduce((acc, curr) => acc + curr.count, 0) || 1;
  const chartData = backlogHealth?.map((entry) => ({
    ...entry,
    fill: statusColors[entry.status.toLowerCase()] || "#cbd5e1",
    percent: Math.round((entry.count * 100) / total),
  }));

  if (isLoading)
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingState />
      </div>
    );
  if (isError)
    return <ErrorState error={isError ? "Could not load data" : ""} />;
  if (backlogHealth && backlogHealth.length === 0) {
    return <EmptyState searchMessage="No tasks yet." />;
  }

  return (
    backlogHealth && (
      <ResponsiveContainer width="100%" height="100%" maxHeight={300}>
        <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 5 }}>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="80%"
            dataKey="percent"
            nameKey="status"
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const { status, percent, fill } = payload[0].payload;
                return (
                  <div className="card border border-text-main">
                    <div className="font-medium text-sm flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: fill }}
                      />
                      {status.charAt(0).toUpperCase() + status.slice(1)}:{" "}
                      {percent}%
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    )
  );
}
