import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { categoryColours } from "../../tasks/constants";
import useGetStats from "../hooks/useGetStats";
import type { TimeSpentData } from "../../../services/api";

export default function TimeSpentChart() {
  const { data: timeSpent, isLoading, isError } = useGetStats<TimeSpentData[]>(data => data.timeSpent)

  if (isLoading) return (
  <div className="flex justify-center items-center">
    <LoadingState />
  </div>
  )
  if (isError) return (
    <ErrorState error={isError ? "Could not load data." : ""} />
  )

  const chartData = timeSpent?.map(data => ({...data, fill: categoryColours[data.category] || categoryColours['General'] }))

  if (chartData && chartData.length === 0){
    return (
      <EmptyState searchMessage="No tasks completed yet."/>
    )
  }

  return (
      chartData && (
        <ResponsiveContainer>
          <BarChart 
            data={chartData} 
            layout="vertical" 
            margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis 
              type="number" 
              tick={{ fill: 'var(--color-text-sub)', fontSize: '14px' }} 
            />
            <YAxis 
              dataKey="category" 
              type="category" 
              width={100}
              tick={{ fill: 'var(--color-text-main)', fontSize: '12px' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(str: string) => {
                const formattedStr = str.replace("-", " ");
                return formattedStr[0].toUpperCase() + formattedStr.substring(1);
              }} 
            />
            <Tooltip
              contentStyle={{ 
                backgroundColor: 'var(--color-surface)', 
                borderColor: 'var(--color-surface-muted)',
                borderRadius: '12px',
                color: 'var(--color-text-main)',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
              }} 
              cursor={{ fill: 'transparent' }}
              labelFormatter={(value) => {
                if (typeof value !== "string") return;
                const formatted = value.replace("-", " ");
                return formatted.charAt(0).toUpperCase() + formatted.slice(1);
              }}
            />
            <Bar 
              name="Minutes Spent"
              dataKey="timeSpent" 
              fill="#6366f1" 
              radius={[0, 4, 4, 0]} 
              activeBar={{ style: { filter: "brightness(120%)"}}}
            />
          </BarChart>
        </ResponsiveContainer>
    )
  );
}