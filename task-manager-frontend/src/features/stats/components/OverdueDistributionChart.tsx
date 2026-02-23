import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorState, LoadingState } from "../../../components/ui";
import useGetOverdueDistribution from "../hooks/useGetOverdueDistribution";
import { useBreakpoint } from "../../../hooks/useBreakpoint";

export default function OverdueDistributionChart() {
  const { data, isLoading, isError } = useGetOverdueDistribution()
  const breakpoint = useBreakpoint()

  function formatDaysOverdue(daysOverdue: string){
    if (["xs", "sm", "md"].includes(breakpoint)) {
      return daysOverdue.replace("Days", "D").replace("Week", "W").replace("Month", "M")
    }
    return daysOverdue
  }
  const colors = [
  "#ffba08", 
  "#f48c06", 
  "#dc2f02", 
  "#9d0208", 
  "#6a040f"
];
  if (isLoading) return <LoadingState />
  if (isError) return <ErrorState error={isError ? "Could not load data." : ""} />

  const chartData = data?.map((d, i) => ({...d, fill: colors[i], daysOverdue: formatDaysOverdue(d.daysOverdue)}))

  return (
    <ResponsiveContainer>
      <BarChart
        data={chartData}
        margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
      >
        <CartesianGrid 
          strokeDasharray="3 3"
          horizontal={false}
        />
        <XAxis
          type="category"
          dataKey="daysOverdue"
          tick={{fill: "var(--color-text-sub)"}}
        /> 
        <YAxis
          type="number"
          dataKey="count"

        />
        <Bar dataKey="count" />
        <Tooltip
          contentStyle={{ 
                backgroundColor: 'var(--color-surface)', 
                borderColor: 'var(--color-surface-muted)',
                borderRadius: '12px',
                color: 'var(--color-text-main)',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
              }} 
              cursor={{ fill: 'transparent' }}
              labelFormatter={str => `${str} overdue`}
              formatter={str => [str,  "Tasks"]}
              itemStyle={{
                  color: 'var(--color-text-main)', 
                }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}