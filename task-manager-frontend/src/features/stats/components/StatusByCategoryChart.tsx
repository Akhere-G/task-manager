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
import useGetCategoryVolume from "../hooks/useGetCategoryVolume";
import { statusColors } from "../constants";

export default function CategoryVolumeChart() {
  const breakpoint = useBreakpoint();
  const { data: categoryVolumeData, isLoading, isError } = useGetCategoryVolume();

  const [activeSeries, setActiveSeries] = useState({
    completed: true,
    pending: false,
    overdue: false,
    total: false,
  });

  const handleLegendClick = ({ dataKey }: LegendPayload) => {
    setActiveSeries((prev) => ({
      ...prev,
      [dataKey as keyof typeof activeSeries]: !prev[dataKey as keyof typeof activeSeries]
    }));
  };

  const getDynamicMax = () => {
    if (!categoryVolumeData) return 0;
    const maxValue = Math.max(
      ...categoryVolumeData.map((category) =>
        {
          const completed = activeSeries.completed ? category.completed : 0
          const overdue = activeSeries.overdue ? category.overdue : 0
          const pending = activeSeries.pending ? category.pending : 0
          const total = activeSeries.total ? category.total : 0
          return Math.max(completed, overdue, pending, total)
        }
      )
    )
    
    return Math.ceil(maxValue)
  };

  const isMobile = breakpoint === "xs";
  const dynamicMax = getDynamicMax();

  if (isLoading) return <div className="flex justify-center items-center h-64"><LoadingState /></div>;
  if (isError) return <ErrorState error="Could not load data" />;
  if (!categoryVolumeData || categoryVolumeData.length === 0) {
    return <EmptyState searchMessage="No tasks found" />;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <RadarChart data={categoryVolumeData} margin={{top:-20, right: 0, left: 0, bottom: 10}}>
        <PolarGrid stroke="var(--color-surface-muted)" />
        <PolarRadiusAxis 
          domain={[0, dynamicMax]} 
          tick={false} 
          axisLine={false} 
          allowDataOverflow
        />
        <PolarAngleAxis 
          dataKey="category" 
          tick={{ fill: 'var(--color-text-main)', fontSize: isMobile ? 9 : 12 }}
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
          contentStyle={{
            backgroundColor: 'var(--color-surface)',
            borderColor: 'var(--color-surface-muted)',
            borderRadius: '12px',
            color: 'var(--color-text-main)',
          }}
          formatter={(value, name, props) => {
            // eslint-disable-next-line react/prop-types
            const dataKey = props.dataKey as keyof typeof activeSeries;
            if (!activeSeries[dataKey]) return [null, null];

            const formattedName = String(name).replaceAll("-", " ");
            return [value, formattedName.charAt(0).toUpperCase() + formattedName.slice(1)];
          }}
          labelFormatter={
            value => {
              const formattedName = String(value).replaceAll("-", " ");
              return formattedName.charAt(0).toUpperCase() + formattedName.slice(1);
            }
          }
        />
        
        <Legend 
          onClick={handleLegendClick}
          wrapperStyle={{ cursor: 'pointer', paddingTop: '40px' }}
          formatter={(value: string, { dataKey }: LegendPayload )  => (
            <span 
              className={`
                ${statusColors[dataKey as string]} ${activeSeries[dataKey as keyof typeof activeSeries] ? "" : "opacity-70 text-text-sub"}`
              }
            >
              {value}
            </span>
          )}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}