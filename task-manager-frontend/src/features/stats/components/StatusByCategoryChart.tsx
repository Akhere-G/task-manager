import { useState } from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
  type LegendPayload,
} from "recharts";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import { statusColors } from "../constants";
import useGetStats from "../hooks/useGetStats";
import type { CategoryVolumeData } from "../../../services/api";
import { categoryColours } from "../../tasks/constants";

export default function CategoryVolumeChart() {
  const breakpoint = useBreakpoint();
  const {
    data: categoryVolume,
    isLoading,
    isError,
  } = useGetStats<CategoryVolumeData[]>((data) => data.categoryVolume);

  const [activeSeries, setActiveSeries] = useState<Record<string, boolean>>({
    completed: true,
    pending: false,
    overdue: false,
    total: false,
  });

  const handleLegendClick = ({ dataKey }: LegendPayload) => {
    setActiveSeries((prev) => ({
      ...prev,
      [dataKey as string]: !prev[dataKey as string],
    }));
  };

  const getDynamicMax = () => {
    if (!categoryVolume) return 0;
    const maxValue = Math.max(
      ...categoryVolume.map((category) => {
        const completed = activeSeries.completed ? category.completed : 0;
        const overdue = activeSeries.overdue ? category.overdue : 0;
        const pending = activeSeries.pending ? category.pending : 0;
        const total = activeSeries.total ? category.total : 0;
        return Math.max(completed, overdue, pending, total);
      }),
    );

    return Math.ceil(maxValue);
  };

  const isMobile = breakpoint === "xs";
  const dynamicMax = getDynamicMax();

  if (isLoading)
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingState />
      </div>
    );
  if (isError) return <ErrorState error="Could not load data" />;
  if (!categoryVolume || categoryVolume.length === 0) {
    return <EmptyState searchMessage="No tasks found." />;
  }

  return (
    <ResponsiveContainer className="pb-2" width="100%" height="100%">
      <RadarChart
        data={categoryVolume}
        margin={{ top: -20, right: 0, left: 0, bottom: -10 }}
      >
        <PolarGrid stroke="var(--color-surface-muted)" />
        <PolarRadiusAxis
          domain={[0, dynamicMax]}
          tick={false}
          axisLine={false}
          allowDataOverflow
        />
        <PolarAngleAxis
          dataKey="category"
          tick={{ fill: "var(--color-text-main)", fontSize: isMobile ? 9 : 12 }}
          tickFormatter={(value) => {
            const formatted = value.replaceAll("-", " ");
            return formatted.charAt(0).toUpperCase() + formatted.slice(1);
          }}
        />

        <Radar
          name="Completed"
          dataKey="completed"
          stroke={statusColors.completed}
          fill={statusColors.completed}
          fillOpacity={activeSeries.completed ? 0.5 : 0}
          strokeOpacity={activeSeries.completed ? 1 : 0}
          animationDuration={300}
        />

        <Radar
          name="Pending"
          dataKey="pending"
          stroke={statusColors.pending}
          fill={statusColors.pending}
          fillOpacity={activeSeries.pending ? 0.3 : 0}
          strokeOpacity={activeSeries.pending ? 1 : 0}
          animationDuration={300}
        />

        <Radar
          name="Overdue"
          dataKey="overdue"
          stroke={statusColors.overdue}
          fill={statusColors.overdue}
          fillOpacity={activeSeries.overdue ? 0.4 : 0}
          strokeOpacity={activeSeries.overdue ? 1 : 0}
          animationDuration={300}
        />

        <Radar
          name="Total"
          dataKey="total"
          stroke={statusColors.total}
          fill={statusColors.total}
          fillOpacity={activeSeries.total ? 0.4 : 0}
          strokeOpacity={activeSeries.total ? 1 : 0}
          animationDuration={300}
        />

        <Tooltip
          content={({ active, payload, label }) => {
            if (active && payload && payload.length) {
              label = String(label);
              return (
                <div className="card border border-text-main">
                  <p className="font-semibold text-text-main mb-2 flex items-center gap-2">
                    <span
                      className="w-2 h-2 rounded-full "
                      style={{ background: categoryColours[label || ""] }}
                    />
                    {label.charAt(0).toUpperCase() + label.slice(1)}
                  </p>
                  <div className="space-y-1">
                    {payload
                      .filter((entry) => activeSeries[entry.name.toLowerCase()])
                      .map((entry) => (
                        <div
                          key={entry.name}
                          className="flex items-center gap-2"
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: entry.stroke }}
                          />
                          <span className="text-sm text-text-main">
                            {entry.name}:{" "}
                            <span className="font-bold">{entry.value}</span>
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              );
            }
            return null;
          }}
        />

        <Legend
          onClick={handleLegendClick}
          wrapperStyle={{ cursor: "pointer", paddingTop: "40px" }}
          formatter={(value: string, { dataKey }: LegendPayload) => (
            <span
              className={`
                ${statusColors[dataKey as string]} ${activeSeries[dataKey as string] ? "" : "opacity-70 text-text-sub"}`}
            >
              {value}
            </span>
          )}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
