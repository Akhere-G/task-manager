import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { categoryColours } from "../../tasks/constants";
import useGetStats from "../hooks/useGetStats";
import type { TimeSpentData } from "../../../services/api";
import { capitalise } from "../../../utils/formators";

export default function TimeSpentChart() {
  const {
    data: timeSpent,
    isLoading,
    isError,
  } = useGetStats<TimeSpentData[]>((data) => data.timeSpent);

  if (isLoading)
    return (
      <div className="flex justify-center items-center">
        <LoadingState />
      </div>
    );
  if (isError)
    return <ErrorState error={isError ? "Could not load data." : ""} />;

  const chartData = timeSpent?.map((data) => ({
    ...data,
    hours: Math.round(data.timeSpent / 60),
    fill: categoryColours[data.category] || categoryColours["General"],
  }));

  if (chartData && chartData.length === 0) {
    return <EmptyState searchMessage="No tasks completed yet." />;
  }

  return (
    chartData && (
      <ResponsiveContainer>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 10, bottom: 0, left: -30 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: "var(--color-text-sub)", fontSize: "14px" }}
          />
          <YAxis
            dataKey="category"
            type="category"
            width={100}
            tick={{ fill: "var(--color-text-main)", fontSize: "12px" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(str: string) => {
              const formattedStr = str.replace("-", " ");
              return formattedStr[0].toUpperCase() + formattedStr.substring(1);
            }}
          />
          <Tooltip
            cursor={{ fill: "var(--color-surface-muted)", opacity: 0.5 }}
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                const time = payload[0].value;
                return (
                  <div className="card border border-text-main">
                    <p className="font-semibold text-text-main mb-2 flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ background: payload[0].payload.fill }}
                      />
                      {capitalise(String(label)).replace("-", " ")}
                    </p>
                    <p className="text-sm text-text-main">
                      Hours spent: <span className="font-bold">{time}</span>
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Bar
            name="Hours Spent"
            dataKey="hours"
            radius={[0, 4, 4, 0]}
            activeBar={{ style: { filter: "brightness(120%)" } }}
          />
        </BarChart>
      </ResponsiveContainer>
    )
  );
}
