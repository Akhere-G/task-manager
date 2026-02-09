import { useEffect, useState } from "react";
import { statsService, type GetProductivityResult } from "../../../services/api";
import { ErrorState, LoadingState } from "../../../components/ui";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function ProductivityChart() {
  const [isLoading, setIsloading] = useState(true);
  const [error, setError] = useState("");
  const [productivityData, setProductivityData] = useState<GetProductivityResult[] | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsloading(true);
      try {
        const result = await statsService.getProductivity();
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

  return (
    <div className="card h-100 w-full">
      <h2 className="text-2xl text-text-main">Productivity</h2> 
      <p className="text-text-sub">Tasks completed daily</p>
      {productivityData && (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={productivityData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(str) => {
                const date = new Date(str);
                return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
              }}
              minTickGap={30}
            />
            <YAxis allowDecimals={false} />
            <Tooltip 
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
            />
            <Legend verticalAlign="top" height={36}/>
            <Line 
              name="Tasks Completed"
              type="monotone" 
              dataKey="tasks" 
              stroke="#6366f1" 
              strokeWidth={3}
              dot={{ r: 4, fill: '#6366f1' }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
  </div>
  );
}