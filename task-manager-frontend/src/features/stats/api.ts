import apiClient from "../../services/api";

export interface ProductivityData {
  date: string;
  tasks: number;
}
export interface TimeSpentData {
  category: string;
  timeSpent: number;
}

export interface BacklogHealthData {
  status: string;
  count: number;
}

export interface CategoryVolumeData {
  category: string;
  completed: number;
  overdue: number;
  pending: number;
  total: number;
}

export interface OverdueDistributionData {
  daysOverdue: string;
  count: number;
}

export interface DeadlineProximityData {
  category: string;
  score: number;
}

export interface HourlyProductivityData {
  hour: number;
  count: number;
}

export interface Turnaround {
  count: number;
  daysTaken: number;
}

export interface EstimationAccuracy {
  id: number;
  title: string;
  category: string;
  estimatedAt: number;
  completedAt: number;
  varianceMinutes: number;
}

export interface WeekOverviewData {
  date: string;
  count: number;
}

export interface DistributionTrendData {
  date: string;
  chores: number;
  finance: number;
  general: number;
  health: number;
  hobbies: number;
  home: number;
  learning: number;
  "life-adim": number;
  "self-care": number;
  social: number;
  work: number;
}

export interface StatsResult {
  productivity: ProductivityData[];
  timeSpent: TimeSpentData[];
  backlogHealth: BacklogHealthData[];
  categoryVolume: CategoryVolumeData[];
  overdueDistribution: OverdueDistributionData[];
  deadlineProximity: DeadlineProximityData[];
  hourlyProductivity: HourlyProductivityData[];
  turnaround: Turnaround[];
  estimationAccuracy: EstimationAccuracy[];
  weekOverview: WeekOverviewData[];
  distributionTrend: DistributionTrendData[];
}
export const statsService = {
  getStats: async (): Promise<StatsResult> => {
    const response = await apiClient.get("/stats/dashboard");
    return response.data;
  },
};
