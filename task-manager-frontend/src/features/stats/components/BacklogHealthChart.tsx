import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { statusColors } from "../constants";
import useGetStats from "../hooks/useGetStats";
import type { BacklogHealthData } from "../../../services/api";



export default function BacklogHealthChart() {
  const { data: backlogHealth, isLoading, isError } = useGetStats<BacklogHealthData[]>(data => data.backlogHealth)

  const chartData = backlogHealth?.map(entry => ({
    ...entry,
    fill: statusColors[entry.status.toLowerCase()] || '#cbd5e1'
  }));

  if (isLoading) return <div className="flex justify-center items-center h-64"><LoadingState /></div>;
  if (isError) return <ErrorState error={isError ? "Could not load data" : ""} />;
  if (backlogHealth && backlogHealth.length === 0){
    return (
        <EmptyState searchMessage="No tasks yet."/>
    )
  }

  return (
        backlogHealth && 
        (
          <ResponsiveContainer width="100%" height="100%" maxHeight={300}>
            <PieChart
              margin={{ top: 0, right: 0, left: 0, bottom: 5 }}
              >
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="80%"
                dataKey="count"
                nameKey="status"
                />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--color-surface)', 
                  borderColor: 'var(--color-surface-muted)',
                  borderRadius: '12px',
                  color: 'var(--color-text-main)',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                }}
                itemStyle={{
                  color: 'var(--color-text-main)', 
                }}                
                />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        )
  );
}