import { useEffect, useState } from "react";
import { statsService, type GetBacklogHealthResult, type GetCategoryVolumeResult, type GetProductivityResult, type GetTimeSpentResult } from "../../../services/api";
import { ErrorState } from "../../../components/ui";

export default function StatsOverview() {
  const [isLoading, setIsloading] = useState(true);
  const [error, setError] = useState("");
  const [backlogData, setBacklogData] = useState<GetBacklogHealthResult[] | null>(null);
  const [categoryVolumeData, setCategoryVolumeData] = useState<GetCategoryVolumeResult[] | null>(null);
  const [timeSpentData, setTimeSpentData] = useState<GetTimeSpentResult[] | null>(null);
  const [productivityData, setProductivityData] = useState<GetProductivityResult[] | null>(null);

  useEffect(() => {
    async function fetchData() {
      setIsloading(true);
      try {
        const [backlog, volume, time, productivity] = await Promise.all([
          statsService.getBacklogHealth(),
          statsService.getCategoryVolume(),
          statsService.getTimeSpent(),
          statsService.getProductivity(365),
        ]);
        setBacklogData(backlog);
        setCategoryVolumeData(volume);
        setTimeSpentData(time);
        setProductivityData(productivity);
        setError("");
      } catch (err: unknown) {
        console.log(err)
        setError("Could not load data");
      } finally {
        setIsloading(false);
      }
    }
    fetchData();
  }, []);

  const stats = {
    completionRate: "0",
    timeInvested: "0",
    currentStreak: "0",
    clearingSpeed: "0",
    weeklyFocus: "None"
  };

  if (!isLoading && backlogData && productivityData && categoryVolumeData && timeSpentData) {
    const completed = backlogData.find(d => d.status === "Completed")?.count || 0;
    const total = backlogData.reduce((acc, cur) => acc + cur.count, 0);
    stats.completionRate = total > 0 ? ((completed / total) * 100).toFixed(0) : "0";

    stats.timeInvested = Math.round(timeSpentData.reduce((acc, cur) => acc + cur.timeSpent, 0) / 60).toString();

    let streak = 0;
    for (let i = productivityData.length - 1; i >= 0; i--) {
      if (productivityData[i].tasks > 0) streak++;
      else break;
    }
    stats.currentStreak = streak.toString();

    const last7Days = productivityData.slice(-7);
    const totalTasks = last7Days.reduce((acc, cur) => acc + cur.tasks, 0);
    stats.clearingSpeed = (totalTasks / 7).toFixed(1);

    if (categoryVolumeData.length > 0) {
      const top = categoryVolumeData.reduce((acc, cur) => acc.count > cur.count ? acc : cur);
      stats.weeklyFocus = top.category.replace(/[_-]/g, " ");
      stats.weeklyFocus = stats.weeklyFocus[0].toUpperCase() + stats.weeklyFocus.slice(1);
    }
  }

  if (error) return <ErrorState error={error} />;

  return (
    <div className="flex flex-wrap gap-6">
      <StatCard isLoading={isLoading} title="Completion Rate" subtext={stats.completionRate} suffix="%" />
      <StatCard isLoading={isLoading} title="Total Invested" subtext={stats.timeInvested} suffix=" hrs" />
      <StatCard isLoading={isLoading} title="Daily Streak" subtext={stats.currentStreak} suffix=" days" />
      <StatCard isLoading={isLoading} title="Velocity" subtext={stats.clearingSpeed} suffix=" tasks/day" />
      <StatCard isLoading={isLoading} title="Top Focus" subtext={stats.weeklyFocus} />
    </div>
  );
}

function StatCard({ title, subtext, suffix, isLoading }: { title: string; subtext: string; suffix?: string; isLoading: boolean }) {
  return (
    <div className="card flex-1 min-w-40 p-4 flex flex-col items-center justify-center text-center shadow-sm border border-border-light transition-all hover:border-brand/30">
      <h3 className="text-text-sub text-sm font-medium uppercase tracking-wider mb-2">{title}</h3>
      {isLoading ? (
        <div className="h-10 w-24 bg-bg-secondary animate-pulse rounded-md" />
      ) : (
        <div className="flex items-baseline gap-1">
          <span className="text-text-main text-3xl font-bold">{subtext}</span>
          {suffix && <span className="text-text-sub text-sm">{suffix}</span>}
        </div>
      )}
    </div>
  );
}