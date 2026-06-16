import CalendarHeatmap from "react-calendar-heatmap";
import { LoadingState, ErrorState, EmptyState } from "../../../components/ui";
import { Tooltip } from "react-tooltip";
import "react-calendar-heatmap/dist/styles.css";
import useGetStats from "../hooks/useGetStats";
import type { ProductivityData } from "../api";

interface HeatmapValueType {
  date: string;
  count: number;
}

export default function ActivityHeatmap() {
  const {
    data: productivity,
    isLoading,
    isError,
  } = useGetStats<ProductivityData[]>((data) => data.productivity);

  if (isLoading)
    return (
      <div className="flex justify-center items-center">
        <LoadingState />
      </div>
    );
  if (isError)
    return <ErrorState error={isError ? "Could not load data" : ""} />;

  const hasData = productivity && productivity.some((d) => d.tasks > 0);

  if (productivity && !hasData) {
    return <EmptyState searchMessage="No tasks completed this year." />;
  }

  const today = new Date();
  const lastYear = new Date();
  lastYear.setFullYear(today.getFullYear() - 1);

  const heatmapValues =
    productivity?.map((item) => ({
      date: item.date,
      count: item.tasks,
    })) || [];

  return (
    <div className="w-full">
      <CalendarHeatmap
        startDate={lastYear}
        endDate={today}
        values={heatmapValues}
        classForValue={(value: HeatmapValueType) => {
          if (!value || value.count === 0) return "color-empty";
          return `color-scale-${Math.min(value.count, 4)}`;
        }}
        tooltipDataAttrs={(value: HeatmapValueType) => ({
          "data-tooltip-id": "heatmap-tooltip",
          "data-tooltip-content": `${value.count} tasks completed on ${new Date(value.date).toLocaleDateString("en-GB")}`,
        })}
      />
      <Tooltip id="heatmap-tooltip" />
    </div>
  );
}
