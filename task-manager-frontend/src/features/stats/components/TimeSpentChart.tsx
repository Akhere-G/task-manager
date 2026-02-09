import { useEffect, useState } from "react";
import { statsService, type GetTimeSpentResult } from "../../../services/api";
import { ErrorState, LoadingState } from "../../../components/ui";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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

  return (
    <div className="card h-100 w-full">
      <h2 className="text-2xl text-text-main">Total time spent per category</h2> 
      {timeSpentData && (
        <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={timeSpentData} 
              layout="vertical" 
              margin={{ top: 5, right: 30, left: 40, bottom: 35 }}
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
                tick={{ fill: 'var(--text-main)' }}
                tickFormatter={(str: string) => {
                  const formattedStr = str.replace("-", " ")
                  return formattedStr[0].toUpperCase() + formattedStr.substring(1)
                }} 
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                contentStyle={{ borderRadius: '8px', border: 'none' }}
              />
              <Bar 
                name="Minutes Spent"
                dataKey="estimatedTime" 
                fill="#6366f1" 
                radius={[0, 4, 4, 0]} 
                activeBar={{fill: 'var(--color-brand)'}}
              />
            </BarChart>
          </ResponsiveContainer>
      )}
  </div>
  );
}