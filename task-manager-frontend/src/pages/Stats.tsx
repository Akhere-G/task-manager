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
} from "../features/stats/components";

export default function Stats() {
  return (
    <div className="flex flex-col gap-6">
      <header className="card">
        <h1 className="text-3xl font-bold text-text-main">Dashboard</h1>
        <p className="text-text-sub">Your productivity.</p>
      </header>

      <StatsOverview />

      {/* Activity is a full-width focus area */}
      <div className="card p-6">
        <h2 className="text-2xl text-text-main">Activity</h2>
        <p className="text-text-sub">Activity this year</p>
        <div className="mt-4">
          <ActivityHeatMap />
        </div>
      </div>

      {/* Row 1: Health (Small) & Productivity (Large > 50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ChartCard
          title="Task Status"
          subtitle="Current completion progress."
          width="lg:col-span-4" // 33%
          height="h-96"
        >
          <BacklogHealthChart />
        </ChartCard>

        <ChartCard
          title="Productivity"
          subtitle="Tasks completed daily."
          width="lg:col-span-8" // 66% (Over 50%)
          height="h-96"
        >
          <ProductivityChart />
        </ChartCard>
      </div>

      {/* Row 2: Category Velocity (Large > 50%) & Overdue (Small) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ChartCard
          title="Deadline Proximity"
          subtitle="Average time until deadlines per category."
          width="lg:col-span-7" // 58% (Over 50%)
          height="h-96"
        >
          <DeadlineProximityChart />
        </ChartCard>

        <ChartCard
          title="Overdue Task Distribution"
          subtitle="How overdue your tasks are."
          width="lg:col-span-5" // 41%
          height="h-96"
        >
          <OverdueDistributionChart />
        </ChartCard>
      </div>

      {/* Row 3: Status by Category (Small) & Time Spent (Large > 50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ChartCard
          title="Category Overview"
          subtitle="Task status by category."
          width="lg:col-span-5" // 41%
          height="h-90 md:h-125"
        >
          <StatusByCategoryChart />
        </ChartCard>

        <ChartCard
          title="Time spent"
          subtitle="Total time spent per category."
          width="lg:col-span-7" // 58% (Over 50%)
          height="h-90 md:h-125"
        >
          <TimeSpentChart />
        </ChartCard>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <ChartCard
          title="Turnaround"
          subtitle="Days taken to complete tasks."
          width="lg:col-span-12" // 66% (Over 50%)
          height="h-96"
        >
          <TurnaroundChart />
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
