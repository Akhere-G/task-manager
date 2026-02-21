
interface ChartCardProps {
  title: string;
  subtitle: string;
  children: React.ReactElement; // Recharts components work best as a single element here
  width: string;
  height: string;
  flex?: string; // Made optional as Tailwind classes often handle this
}

export default function ChartCard({ title, subtitle, children, width, height }: ChartCardProps) {
  return (
    <div className={`card ${width} ${height} flex flex-col`}>
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-text-main">{title}</h2> 
        <p className="text-text-sub text-sm">{subtitle}</p>
      </div>
      
      {/* The wrapper div below ensures the chart expands to fill the card */}
      <div className="flex-grow w-full">
          {children}
      </div>
    </div>
  );
}