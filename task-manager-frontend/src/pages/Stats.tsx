import { ActivityHeatMap, BacklogHealthChart, CategoryVelocityChart, ChartCard, OverdueDistributionChart, ProductivityChart, StatsOverview, StatusByCategoryChart, TimeSpentChart } from "../features/stats/components";

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
          height="h-90"
          flex="0.25"
        >
          <BacklogHealthChart />
        </ChartCard>

        <ChartCard 
          title="Productivity"
          subtitle="Tasks completed daily"
          width="lg:w-[65%]"
          height="h-90"
          flex="0.75"
        >
          <ProductivityChart />
        </ChartCard>
      </div>
      <div className="flex flex-col gap-6 lg:flex-row">
        <ChartCard 
          title="Distribution Overview"
          subtitle="Task status by category."
          width="lg:w-[35%]"
          height="h-90 lg:h-120"
          flex="1"
        >
          <StatusByCategoryChart />
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
      <div className="flex gap-6">
        <ChartCard 
          title="Overdue Task Distribution"
          subtitle="How overdue your tasks are"
          width="w-1/2"
          height="h-90"
          flex="0.5"
        >
          <OverdueDistributionChart />
        </ChartCard>
        <ChartCard 
          title="Category Velocity"
          subtitle="Average time until due dates per category."
          width="w-1/2"
          height="h-90"
          flex="0.5"
        >
          <CategoryVelocityChart />
        </ChartCard>

      </div>
    </div>
  </div>
  );
}

