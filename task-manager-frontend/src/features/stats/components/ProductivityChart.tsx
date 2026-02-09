import { useEffect, useState } from "react";
import { statsService, type GetProductivityResult } from "../../../services/api";
import { ErrorState, LoadingState } from "../../../components/ui";
import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

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
        console.error(err);
        setError("Could not load data");
      } finally {
        setIsloading(false);
      }
    }
    fetchData();
  }, []);

  if (isLoading) return (
    <div className="flex justify-center items-center h-full">
      <LoadingState />
    </div>
  );
  
  if (error) return (
    <div className="flex justify-center items-center h-full">
      <ErrorState error={error} />
    </div>
  );

  return (
    productivityData && (
        <LineChart data={productivityData} margin={{ top: 20, right: 30, left: 0, bottom: 50 }}>
          {/* Grid lines using your surface-muted variable */}
          <CartesianGrid 
            strokeDasharray="3 3" 
            vertical={false} 
            stroke="var(--color-surface-muted)" 
          />
          
          <XAxis 
            dataKey="date" 
            tick={{ fill: 'var(--color-text-sub)', fontSize: '12px' }}
            axisLine={{ stroke: 'var(--color-surface-muted)' }}
            tickLine={false}
            tickFormatter={(str) => {
              const date = new Date(str);
              return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
            }}
            minTickGap={30}
          />
          
          <YAxis 
            allowDecimals={false} 
            tick={{ fill: 'var(--color-text-sub)', fontSize: '12px' }}
            axisLine={false}
            tickLine={false}
          />
          
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--color-surface)', 
              borderColor: 'var(--color-surface-muted)',
              borderRadius: '12px',
              color: 'var(--color-text-main)',
              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
            }}
            itemStyle={{ color: 'var(--color-brand)', fontWeight: 'bold' }}
            labelStyle={{ color: 'var(--color-text-sub)', marginBottom: '4px' }}
            labelFormatter={(str) => {
              const date = new Date(str);
              return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: "numeric" });
            }}
          />
          
          <Legend 
            verticalAlign="top" 
            height={40}
            formatter={(value) => <span style={{ color: 'var(--color-text-main)', fontSize: '14px', fontWeight: 500 }}>{value}</span>}
          />
          
          <Line 
            name="Tasks completed"
            type="monotone" 
            dataKey="tasks" 
            stroke="var(--color-brand)" 
            strokeWidth={3}
            dot={{ r: 4, fill: 'var(--color-brand)', strokeWidth: 2, stroke: 'var(--color-surface)' }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </LineChart>
    )
  );
}