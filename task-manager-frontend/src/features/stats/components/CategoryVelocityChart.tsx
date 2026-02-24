import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ErrorState, LoadingState } from "../../../components/ui";
import useGetCategoryVelocity from "../hooks/useGetCategoryVelocity.ts";

export default function CategoryVelocityChart() {
  const { data, isLoading, isError } = useGetCategoryVelocity()

  const getBarColor = (score: number) => {
    const positiveColors = [
      "#d9f99d", // Lightest (0-3 days ahead)
      "#86efac", 
      "#22c55e", 
      "#16a34a", 
      "#064e3b"  // Darkest (30+ days ahead)
    ];

    const negativeColors = [
      "#fca5a5", // Lightest (0-3 days overdue)
      "#f87171", 
      "#ef4444", 
      "#dc2626", 
      "#991b1b"  // Darkest (30+ days overdue)
    ];

    const absScore = Math.abs(score);
    const palette = score >= 0 ? positiveColors : negativeColors;

    // Assign intensity based on the absolute number of days
    if (absScore <= 3) return palette[0];
    if (absScore <= 7) return palette[1];
    if (absScore <= 14) return palette[2];
    if (absScore <= 30) return palette[3];
    return palette[4];
  };
  
  if (isLoading) return <LoadingState />
  if (isError) return <ErrorState error={isError ? "Could not load data." : ""} />

  const chartData = data?.map((d) => ({...d, fill: getBarColor(d.score) }))

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
          dataKey="category"
          tick={{fill: "var(--color-text-sub)"}}
        /> 
        <YAxis
          type="number"
          dataKey="score"

        />
        <Bar dataKey="score" />
        <Tooltip
          contentStyle={{ 
                backgroundColor: 'var(--color-surface)', 
                borderColor: 'var(--color-surface-muted)',
                borderRadius: '12px',
                color: 'var(--color-text-main)',
                boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
          }} 
          cursor={{ fill: 'transparent' }}
          formatter={(value) => {
            return [Math.round(value as number), value as number >= 0  ? "Avg days ahead of due date" : "Avg days behind due date"]
          }}
          itemStyle={{
            color: 'var(--color-text-main)', 
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}