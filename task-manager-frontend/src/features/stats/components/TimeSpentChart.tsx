import { useEffect, useState } from "react";
import { statsService, type GetTimeSpentResult } from "../../../services/api";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { categoryColours } from "../../tasks/constants";

export default function TimeSpentChart() {
  const [isLoading, setIsloading] = useState(true);
  const [error, setError] = useState("");
  const [timeSpentData, setTimeSpentData] = useState<GetTimeSpentResult[] | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsloading(true);
      try {
        const result = await statsService.getTimeSpent();
        setTimeSpentData(result);
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

  const data = timeSpentData?.map(data => ({...data, fill: categoryColours[data.category] || categoryColours['General'] }))

  if (data && data.length == 0){
        return (
          <div>
            <EmptyState searchMessage="No tasks completed recently"/>
          </div>
        )
    }

  return (
      timeSpentData && (
        <ResponsiveContainer>
          <BarChart 
            data={data} 
            layout="vertical" 
            margin={{ top: 5, right: 30, left: 40, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis 
              type="number" 
              label={{ 
                value: "minutes", 
                position: "insideBottom", 
                offset: -10, 
                style: { fill: 'var(--text-sub)', fontSize: '14px' } 
              }} 
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
              cursor={{ fill: 'transparent' }}
              contentStyle={{ borderRadius: '8px', border: 'none' }}
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