import { useEffect, useState } from "react";
import { statsService, type GetCategoryVolumeResult } from "../../../services/api";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer } from "recharts";
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
  const isDesktop = ["lg", "xl", "2xl"].includes(breakpoint);

  if (isLoading) return <div className="flex justify-center items-center h-64"><LoadingState /></div>;
  if (error) return <ErrorState error={error} />;
  if (chartData && chartData.length === 0){
      return (
        <div>
          <EmptyState searchMessage="No pending tasks"/>
        </div>
      )
  }

  return (
        categoryVolumeData && 
        (
          <ResponsiveContainer>
            <PieChart
              margin={{ top: 0, right: 0, left: 0, bottom: isDesktop ? 50 : 0 }}
            >
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius="60%"
                outerRadius="80%"
                dataKey="count"
                nameKey="category"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'var(--color-surface)', 
                  borderColor: 'var(--color-surface-muted)',
                  borderRadius: '12px',
                  color: 'var(--color-text-main)',
                  boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                }}
                itemStyle={{
                  color: 'var(--color-text-main)', 
                }}
                cursor={{ fill: 'transparent' }}
                formatter={(value, name) => {
                  if (typeof name !== "string") return
                  const formatted = name.replace("-", " ");
                  return [value, formatted.charAt(0).toUpperCase() + formatted.slice(1)];
                }}
              />
              {!isMobile && <Legend className="xs:blocksm:block md:block lg:block xl:block 2xl:block " verticalAlign="bottom" height={36} />}
            </PieChart>
          </ResponsiveContainer>  
        )
  );
}