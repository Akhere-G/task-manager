import {
  ActivityHeatMap,
  BacklogHealthChart,
  DeadlineProximityChart,
  ChartCard,
  HourlyProductivityChart,
  OverdueDistributionChart,
  ProductivityChart,
  StatsOverview,
  StatusByCategoryChart,
  TimeSpentChart,
  TurnaroundChart,
  EstimationAccuracyChart,
  WeekOverviewChart,
  DistributionTrendChart,
} from "../features/stats/components";

export default function Stats() {
  return (
    <div className="flex flex-col gap-6">
      <header className="card">
        <h1 className="text-3xl font-bold text-text-main">Dashboard</h1>
        <p className="text-text-sub">Your productivity.</p>
      </header>

      <StatsOverview />

      <h2 className="text-2xl border-b mt-4">Performance Summary</h2>

      <ChartCard
        title="Activity"
        subtitle="Activity this year."
        width="lg:col-span-4"
        height=""
      >
        <ActivityHeatMap />
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ChartCard
          title="Task Status"
          subtitle="Current completion progress."
          width="lg:col-span-4"
          height="h-96"
        >
          <BacklogHealthChart />
        </ChartCard>

        <ChartCard
          title="Productivity"
          subtitle="Tasks completed daily."
          width="lg:col-span-8"
          height="h-96"
        >
          <ProductivityChart />
        </ChartCard>
      </div>
      <h2 className="text-2xl border-b mt-4">Planning & Deadlines</h2>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ChartCard
          title="Upcoming Deadlines"
          subtitle="Workload over the next week."
          width="lg:col-span-12"
          height="h-96"
        >
          <WeekOverviewChart />
        </ChartCard>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ChartCard
          title="Deadline Proximity"
          subtitle="Average time until deadlines per category."
          width="lg:col-span-7"
          height="h-96"
        >
          <DeadlineProximityChart />
        </ChartCard>

        <ChartCard
          title="Overdue Task Distribution"
          subtitle="How overdue your tasks are."
          width="lg:col-span-5"
          height="h-96"
        >
          <OverdueDistributionChart />
        </ChartCard>
      </div>
      <h2 className="text-2xl border-b mt-4">Workload Distribution</h2>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ChartCard
          title="Category Overview"
          subtitle="Task status by category."
          width="lg:col-span-5"
          height="h-90 md:h-125"
        >
          <StatusByCategoryChart />
        </ChartCard>

        <ChartCard
          title="Time spent"
          subtitle="Total time spent per category."
          width="lg:col-span-7"
          height="h-90 md:h-125"
        >
          <TimeSpentChart />
        </ChartCard>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ChartCard
          title="Weekly Flow"
          subtitle="A breakdown of completed tasks by category over the last seven days."
          width="lg:col-span-12"
          height="h-96"
        >
          <DistributionTrendChart />
        </ChartCard>
      </div>
      <h2 className="text-2xl border-b mt-4">Trends & Insights</h2>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ChartCard
          title="Turnaround"
          subtitle="Days taken to complete tasks."
          width="lg:col-span-7"
          height="h-96"
        >
          <TurnaroundChart />
        </ChartCard>
        <ChartCard
          title="Estimation Accuracy"
          subtitle="Comparing scheduled deadlines vs. actual completion."
          width="lg:col-span-5"
          height="h-96"
        >
          <EstimationAccuracyChart />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ChartCard
          title="Hourly Productivity"
          subtitle="See when you are most productive."
          width="lg:col-span-12"
          height="h-90 md:h-125"
        >
          <HourlyProductivityChart />
        </ChartCard>
      </div>
    </div>
  );
}
