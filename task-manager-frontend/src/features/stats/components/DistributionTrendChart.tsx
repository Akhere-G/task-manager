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
import useProjectColours from "../../projects/hooks/useProjectColours";
import ChartToolTip from "./ChartToolTip";
import type { DistributionTrendData } from "../api";

interface Row {
  date: string;
  [seriesKey: string]: number | string;
}

/** Series keys are indexes because project names may contain dots or dashes. */
function toRows(days: DistributionTrendData[]) {
  const names = [
    ...new Set(days.flatMap((day) => day.counts.map((c) => c.project))),
  ];
  const rows: Row[] = days.map((day) => {
    const row: Row = { date: day.date };
    names.forEach((name, index) => {
      row[`s${index}`] = day.counts.find((c) => c.project === name)?.count ?? 0;
    });
    return row;
  });
  return { names, rows };
}

export default function DistributionTrendChart() {
  const { data, isLoading, isError } = useGetStats<DistributionTrendData[]>(
    (stats) => stats.distributionTrend,
  );

  const colourFor = useProjectColours();
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

  const { names, rows } = toRows(data ?? []);
  const hasNoData = rows.every((row) =>
    names.every((_, index) => row[`s${index}`] === 0),
  );

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error="Could not load data." />;
  if (!data || data.length === 0 || hasNoData)
    return <EmptyState searchMessage="No tasks completed recently." />;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={rows}
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

            const sortedItems = names
              .map((name, index) => ({
                title: name,
                name: `s${index}`,
                value: Number(data[`s${index}`]) || 0,
                colour: colourFor(name),
              }))
              .filter(
                (item) =>
                  item.value > 0 && !hiddenCategories.includes(item.name),
              )
              .sort((a, b) => b.value - a.value);
            const series =
              sortedItems.length === 0
                ? [{ name: "No tasks completed." }]
                : sortedItems.map(({ title, value, colour }) => ({
                    name: title,
                    value: String(value),
                    fill: colour,
                  }));
            return (
              <ChartToolTip
                title={{
                  name: formatDate(new Date(label), "EEE do MMM"),
                }}
                series={series}
              />
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

        {names.map((name, index) => {
          const key = `s${index}`;
          const hidden = hiddenCategories.includes(key);
          return (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              name={name}
              stackId="1"
              stroke={colourFor(name)}
              fill={colourFor(name)}
              isAnimationActive={true}
              animationDuration={500}
              data={rows.map((row) => ({
                ...row,
                [key]: hidden ? 0 : row[key],
              }))}
              fillOpacity={hidden ? 0 : 0.6}
              strokeOpacity={hidden ? 0 : 1}
            />
          );
        })}
      </AreaChart>
    </ResponsiveContainer>
  );
}
