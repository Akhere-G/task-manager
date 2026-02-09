import { BacklogHealthChart, CategoryVolumeChart, ProductivityChart, TimeSpentChart } from "../features/stats/components";

export default function Stats() {
  return (
    <div className="flex flex-col gap-6">
      <header className="card">
        <h1 className="text-3xl font-bold text-text-main">Dashboard</h1>
        <p className="text-text-sub">Your productivity over the last 30 days.</p>
      </header>

        <ProductivityChart />
        <TimeSpentChart />
        <BacklogHealthChart />
        <CategoryVolumeChart />
    </div>
  );
}

