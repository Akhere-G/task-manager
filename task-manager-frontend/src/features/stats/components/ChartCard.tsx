
interface ChartCardProps {
  title: string;
  subtitle: string;
  children: React.ReactElement; 
  width: string;
  height: string;
  flex?: string; 
}

export default function ChartCard({ title, subtitle, children, width, height }: ChartCardProps) {
  return (
    <div className={`card ${width} ${height} flex flex-col`}>
      <div className="mb-4">
        <h2 className="text-2xl font-semibold text-text-main">{title}</h2> 
        <p className="text-text-sub text-sm">{subtitle}</p>
      </div>
      
      <div className="grow w-full">
          {children}
      </div>
    </div>
  );
}