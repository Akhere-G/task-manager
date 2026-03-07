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
            contentStyle={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border-light)",
              borderRadius: "12px",
              color: "var(--color-text-main)",
              boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
            }}
            itemStyle={{
              color: "var(--color-text-main)",
            }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                console.log(payload);
                const { status, percent, fill } = payload[0].payload;

                return (
                  <div className="bg-surface border border-border-light p-3 rounded-xl shadow-lg">
                    <p className="font-medium text-sm" style={{ color: fill }}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}:{" "}
                      {percent}%
                    </p>
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
