import { useEffect, useState } from "react";
import { statsService, type GetBacklogHealthResult } from "../../../services/api";
import { ErrorState, LoadingState } from "../../../components/ui";
import { PieChart, Pie, ResponsiveContainer, Tooltip, Legend } from "recharts";

const COLORS: Record<string, string> = {
  Completed: '#10b981', 
  Pending: '#f59e0b',   
  Overdue: '#ef4444'    
};

export default function BacklogHealthChart() {
  const [isLoading, setIsloading] = useState(true);
  const [error, setError] = useState("");
  const [backlogData, setBacklogData] = useState<GetBacklogHealthResult[] | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsloading(true);
      try {
        const result = await statsService.getBacklogHealth();
        setBacklogData(result);
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

  const chartData = backlogData?.map(entry => ({
    ...entry,
    fill: COLORS[entry.status] || '#cbd5e1'
  }));

  if (isLoading) return <div className="flex justify-center items-center h-64"><LoadingState /></div>;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="card h-100 w-full flex flex-col">
      <h2 className="text-2xl text-text-main mb-4">Backlog Health</h2> 
      <p className="text-text-sub">Tasks by status</p>
      <div className="flex-1 w-full">
        {backlogData && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="80%"
                paddingAngle={5}
                dataKey="count"
                nameKey="status"
              />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend verticalAlign="bottom" height={36} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}