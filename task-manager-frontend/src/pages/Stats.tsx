import { BacklogHealthChart, CategoryVolumeChart, ChartCard, ProductivityChart, TimeSpentChart } from "../features/stats/components";

export default function Stats() {
  return (
    <div className="flex flex-col gap-6">
      <header className="card">
        <h1 className="text-3xl font-bold text-text-main">Dashboard</h1>
        <p className="text-text-sub">Your productivity over the last 30 days.</p>
      </header>

    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6 lg:flex-row ">
        <ChartCard 
          title="Backlog Health"
          subtitle="Tasks by status"
          width="w-full"
          height="h-100 lg:h-150"
          flex="0.25"
        >
          <BacklogHealthChart />
        </ChartCard>

        <ChartCard 
          title="Productivity"
          subtitle="Tasks completed daily"
          width="w-full"
          height="h-100 lg:h-150"
          flex="0.75"
        >
          <ProductivityChart />
        </ChartCard>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <ChartCard 
          title="Category Volume"
          subtitle="Pending tasks by category"
          width="w-full"
          height="h-100 lg:h-150"
          flex="0.25"
        >
          <CategoryVolumeChart />
        </ChartCard>

        <ChartCard 
          title="Time spent"
          subtitle="Total time spent per category"
          width="w-full"
          height="h-150"
          flex="0.75"
        >
            <TimeSpentChart />
        </ChartCard>
      </div>
    </div>
  </div>
  );
}

