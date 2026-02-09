import { useEffect, useState } from "react";
import { 
  CartesianGrid, 
  Legend, 
  Line, 
  LineChart, 
  Tooltip, 
  XAxis, 
  YAxis, 
  ResponsiveContainer 
} from "recharts";
import { statsService, type GetProductivityResult } from "../services/api";

export default function Stats() {
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

  if (isLoading) return <div className="p-8 text-center">Loading your progress...</div>;
  if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

  return (
    <div className="flex flex-col gap-6">
      <header className="card">
        <h1 className="text-3xl font-bold text-text-main">Dashboard</h1>
        <p className="text-text-sub">Your productivity over the last 30 days.</p>
      </header>

      <div className="card h-100 w-full"> 
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
    </div>
  );
}