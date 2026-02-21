import { ActivityHeatMap, BacklogHealthChart, CategoryVolumeChart, ChartCard, ProductivityChart, StatsOverview, TimeSpentChart } from "../features/stats/components";

export default function Stats() {
  return (
    <div className="flex flex-col gap-6">
      <header className="card">
        <h1 className="text-3xl font-bold text-text-main">Dashboard</h1>
        <p className="text-text-sub">Your productivity.</p>
      </header>

    <StatsOverview />
    
    <div className="card">
        <h2 className="text-2xl text-text-main">Activity</h2> 
        <p className="text-text-sub">Activity this year</p>
        <ActivityHeatMap />
    </div>

    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-6 lg:flex-row ">
        <ChartCard 
          title="Task Status"
          subtitle="Current completion progress"
          width="lg:w-[35%]"
          height="h-90 lg:h-120"
          flex="0.25"
        >
          <BacklogHealthChart />
        </ChartCard>

        <ChartCard 
          title="Productivity"
          subtitle="Tasks completed daily"
          width="lg:w-[65%]"
          height="h-90 lg:h-120"
          flex="0.75"
        >
          <ProductivityChart />
        </ChartCard>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <ChartCard 
          title="Active Balance"
          subtitle="Pending tasks by category"
          width="lg:w-[35%]"
          height="h-90 lg:h-120"
          flex="0.25"
        >
          <CategoryVolumeChart />
        </ChartCard>

        <ChartCard 
          title="Time spent"
          subtitle="Total time spent per category"
          width="lg:w-[65%]"
          height="h-90 lg:h-120"
          flex="0.75"
        >
            <TimeSpentChart />
        </ChartCard>
      </div>
      
    </div>
  </div>
  );
}

