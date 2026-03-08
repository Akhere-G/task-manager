import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  type LegendPayload,
  type DataKey,
} from "recharts";
import { formatDate } from "date-fns";
import { LoadingState, ErrorState, EmptyState } from "../../../components/ui";
import { useBreakpoint } from "../../../hooks/useBreakpoint";
import useGetStats from "../hooks/useGetStats";
import type { DistributionTrendData } from "../../../services/api";
import { categoryColours } from "../../tasks/constants";
import { capitalise } from "../../../utils/formators";

const CATEGORIES = [
  "work",
  "home",
  "chores",
  "life-admin",
  "health",
  "self-care",
  "social",
  "hobbies",
  "learning",
  "finance",
  "general",
];

export default function DistributionTrendChart() {
  const { data, isLoading, isError } = useGetStats<DistributionTrendData[]>(
    (stats) => stats.distributionTrend,
  );

  const [hiddenCategories, setHiddenCategories] = useState<string[]>([]);
  const breakpoint = useBreakpoint();
  const isMobile = ["xs", "sm"].includes(breakpoint);
  const isSmallDesktop = breakpoint === "md";

  const handleLegendClick = (o: LegendPayload) => {
    const dataKey = o.dataKey as string;
    setHiddenCategories((prev) =>
      prev.includes(dataKey)
        ? prev.filter((c) => c !== dataKey)
        : [...prev, dataKey],
    );
  };

  console.log(data);

  const hasNoData =
    data?.every((d) =>
      Object.values({ ...d, date: 0 }).every((v) => v === 0),
    ) ?? false;

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error="Could not load data." />;
  if (!data || data.length === 0 || hasNoData)
    return <EmptyState searchMessage="No tasks completed recently." />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{
          top: 0,
          right: 5,
          left: isMobile || isSmallDesktop ? -15 : -30,
          bottom: 0,
        }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          vertical={false}
          stroke="var(--color-border-light)"
        />
        <XAxis
          dataKey="date"
          allowDuplicatedCategory={false}
          tickFormatter={(d) =>
            formatDate(new Date(d), isMobile ? "EEE" : "EEE d MMM")
          }
          tick={{ fill: "var(--color-text-main)", fontSize: 12 }}
        />
        <YAxis tick={{ fill: "var(--color-text-main)", fontSize: 12 }} />
        <Tooltip
          content={({ payload, label = "" }) => {
            if (!payload?.[0]?.payload) return;
            const data = payload[0].payload;

            const sortedItems = CATEGORIES.map((cat) => ({
              title: capitalise(cat).replaceAll("-", " "),
              name: cat,
              value: data[cat] || 0,
              colour: categoryColours[cat],
            }))
              .filter(
                (item) =>
                  item.value > 0 && !hiddenCategories.includes(item.name),
              )
              .sort((a, b) => b.value - a.value);

            return (
              <div className="card border border-text-main">
                <p className="font-semibold text-text-main mb-2">
                  {formatDate(new Date(label), "EEE do MMM")}
                </p>
                <div className="space-y-1">
                  {sortedItems.length === 0 && <p>No tasks completed.</p>}
                  {sortedItems.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.colour }}
                      />
                      <span className="text-text-main text-sm font-medium">
                        {item.title}: {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          }}
        />

        <Legend
          verticalAlign="top"
          onClick={handleLegendClick}
          wrapperStyle={{ cursor: "pointer" }}
          formatter={(value: DataKey<string>, entry: LegendPayload) => (
            <span
              style={{
                color: hiddenCategories.includes(String(entry.dataKey))
                  ? "#94a3b8"
                  : "var(--color-text-main)",
              }}
            >
              {String(value)}
            </span>
          )}
        />

        {CATEGORIES.map((cat) => (
          <Area
            key={cat}
            type="monotone"
            dataKey={cat}
            name={cat
              .replace("-", " ")
              .replace(/\b\w/g, (l) => l.toUpperCase())}
            stackId="1"
            stroke={categoryColours[cat]}
            fill={categoryColours[cat]}
            isAnimationActive={true}
            animationDuration={500}
            data={data.map((item) => ({
              ...item,
              [cat]: hiddenCategories.includes(cat)
                ? 0
                : item[cat as keyof DistributionTrendData],
            }))}
            fillOpacity={hiddenCategories.includes(cat) ? 0 : 0.6}
            strokeOpacity={hiddenCategories.includes(cat) ? 0 : 1}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
