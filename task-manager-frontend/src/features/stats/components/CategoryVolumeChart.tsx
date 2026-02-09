import { useEffect, useState } from "react";
import { statsService, type GetCategoryVolumeResult } from "../../../services/api";
import { ErrorState, LoadingState } from "../../../components/ui";
import { PieChart, Pie, Tooltip, Legend } from "recharts";
import { categoryColours } from "../../tasks/constants";
import { useBreakpoint } from "../../../hooks/useBreakpoint";

export default function CategoryVolumeChart() {
  const [isLoading, setIsloading] = useState(true);
  const [error, setError] = useState("");
  const [categoryVolumeData, setCategoryVolumeData] = useState<GetCategoryVolumeResult[] | null>(null);
  const breakpoint = useBreakpoint()
  
  useEffect(() => {
    async function fetchData() {
      setIsloading(true);
      try {
        const result = await statsService.getCategoryVolume();
        setCategoryVolumeData(result);
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

  const chartData = categoryVolumeData?.map(entry =>  ({
    ...entry,
    fill: categoryColours[entry.category] || '#cbd5e1'
  }));

  const isMobile = breakpoint === "xs";

  if (isLoading) return <div className="flex justify-center items-center h-64"><LoadingState /></div>;
  if (error) return <ErrorState error={error} />;

  return (
        categoryVolumeData && 
        (
            <PieChart
              margin={{ top: 20, right: 0, left: 0, bottom: 120 }}
            >
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="80%"
                paddingAngle={1}
                dataKey="count"
                nameKey="category"
              />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value, name) => {
                  if (typeof name !== "string") return
                  const formatted = name.replace("-", " ");
                  return [value, formatted.charAt(0).toUpperCase() + formatted.slice(1)];
                }}
              />
              {!isMobile && <Legend className="xs:blocksm:block md:block lg:block xl:block 2xl:block " verticalAlign="bottom" height={36} />}
            </PieChart>
        )
  );
}