import { useEffect, useState } from "react";
import CalendarHeatmap from "react-calendar-heatmap";
import { statsService, type GetProductivityResult } from "../../../services/api";
import { LoadingState, ErrorState } from "../../../components/ui";
import { Tooltip } from "react-tooltip";
import "react-calendar-heatmap/dist/styles.css";

interface HeatmapValueType {
  date: string;
  count: number;
}

export default function ActivityHeatmap() {
  const [isLoading, setIsloading] = useState(true);
  const [error, setError] = useState("");
  const [productivityData, setProductivityData] = useState<GetProductivityResult[] | null>(null);
  
  useEffect(() => {
    async function fetchData() {
      setIsloading(true);
      try {
        const result = await statsService.getProductivity(365);
        setProductivityData(result);
        setError("");
      } catch (err: unknown) {
        console.log(err)
        setError("Could not load data");
      } finally {
        setIsloading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) return (
    <div className="flex justify-center items-center">
      <LoadingState />
    </div>
    )
  if (error) return (
    <ErrorState error={error} />
  )

  const today = new Date();
  const lastYear = new Date();
  lastYear.setFullYear(today.getFullYear() - 1);

  const heatmapValues = productivityData?.map(item => ({
    date: item.date,
    count: item.tasks
  })) || [];

  return (
    <div className="w-full">
      <CalendarHeatmap
        startDate={lastYear}
        endDate={today}
        values={heatmapValues}
        classForValue={(value: HeatmapValueType) => {
          if (!value || value.count === 0) return 'color-empty';
          // Caps at scale-4 for the darkest indigo
          return `color-scale-${Math.min(value.count, 4)}`;
        }}
        tooltipDataAttrs={(value: HeatmapValueType) => ({
          'data-tooltip-id': 'heatmap-tooltip',
          'data-tooltip-content': value.date 
            ? `${value.count} tasks on ${new Date(value.date).toLocaleDateString('en-GB')}`
            : 'No activity',
        })}
      />
      <Tooltip id="heatmap-tooltip" />
    </div>

  );
}