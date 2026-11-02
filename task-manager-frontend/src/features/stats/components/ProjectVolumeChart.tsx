import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer } from "recharts";
import useProjectColours from "../../projects/hooks/useProjectColours";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import useGetStats from "../hooks/useGetStats";
import type { ProjectVolumeData } from "../api";

export default function ProjectVolumeChart() {
  const breakpoint = useBreakpoint();
  const colourFor = useProjectColours();

  const {
    data: projectVolume,
    isLoading,
    isError,
  } = useGetStats<ProjectVolumeData[]>((data) => data.projectVolume);

  const chartData = projectVolume?.map((entry) => ({
    ...entry,
    fill: colourFor(entry.project),
  }));

  const isMobile = breakpoint === "xs";
  const isDesktop = ["lg", "xl", "2xl"].includes(breakpoint);

  if (isLoading)
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingState />
      </div>
    );
  if (isError)
    return <ErrorState error={isError ? "Could not load data" : ""} />;
  if (chartData && chartData.length === 0) {
    return (
      <div>
        <EmptyState searchMessage="No pending tasks" />
      </div>
    );
  }

  return (
    projectVolume && (
      <ResponsiveContainer>
        <PieChart
          margin={{ top: 0, right: 0, left: 0, bottom: isDesktop ? 50 : 0 }}
        >
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius="60%"
            outerRadius="80%"
            dataKey="pending"
            nameKey="project"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border-light)",
              borderRadius: "12px",
              color: "var(--color-text-main)",
              boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
            }}
            itemStyle={{
              color: "var(--color-text-main)",
            }}
            cursor={{ fill: "transparent" }}
            formatter={(value, name) => {
              if (typeof name !== "string") return;
              const formatted = name.replace("-", " ");
              return [
                value,
                formatted.charAt(0).toUpperCase() + formatted.slice(1),
              ];
            }}
          />
          {!isMobile && (
            <Legend
              className="xs:blocksm:block md:block lg:block xl:block 2xl:block "
              verticalAlign="bottom"
              height={36}
              formatter={(label: string) => {
                const formatted = label.replace("-", " ");
                return formatted[0].toUpperCase() + formatted.slice(1);
              }}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    )
  );
}
