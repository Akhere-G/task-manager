import { ResponsiveContainer } from "recharts";

interface ChartCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  width: string;
  height: string;
  flex: string;
}

export default function ChartCard({ title, subtitle, children, width, height, flex }: ChartCardProps) {
  return (
    <div className={`card ${width} ${height} flex-${flex}`}>
      <h2 className="text-2xl text-text-main">{title}</h2> 
      <p className="text-text-sub">{subtitle}</p>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
  </div>
  );
}