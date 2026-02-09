import { useEffect, useState } from "react";
import { statsService, type GetCategoryVolumeResult } from "../../../services/api";
import { ErrorState, LoadingState } from "../../../components/ui";
import { PieChart, Pie, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { categoryColours } from "../../tasks/constants";

export default function CategoryVolumeChart() {
  const [isLoading, setIsloading] = useState(true);
  const [error, setError] = useState("");
  const [backlogData, setBacklogData] = useState<GetCategoryVolumeResult[] | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsloading(true);
      try {
        const result = await statsService.getCategoryVolume();
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

  const chartData = backlogData?.map(entry =>  ({
    ...entry,
    fill: categoryColours[entry.category] || '#cbd5e1'
  }));

  if (isLoading) return <div className="flex justify-center items-center h-64"><LoadingState /></div>;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="card h-100 w-full flex flex-col">
      <h2 className="text-2xl text-text-main mb-4">Category Volume</h2> 
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
                nameKey="category"
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