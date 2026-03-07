/* eslint-disable react/prop-types */
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { format, fromUnixTime } from "date-fns";
import { EmptyState, ErrorState, LoadingState } from "../../../components/ui";
import useGetStats from "../hooks/useGetStats";
import type { EstimationAccuracy } from "../../../services/api";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

export default function EstimationAccuracyChart() {
  const {
    data: accuracyData,
    isLoading,
    isError,
  } = useGetStats<EstimationAccuracy[]>((stats) => stats.estimationAccuracy);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState error="Could not load accuracy data." />;
  if (!accuracyData || !accuracyData.length)
    return <EmptyState searchMessage="No data." />;

  const allTasks = accuracyData.map((d) => ({
    ...d,
    fill:
      d.varianceMinutes >= 0 ? "var(--color-success)" : "var(--color-failure)",
  }));

  const allTimestamps = accuracyData.flatMap((d) => [
    d.estimatedAt,
    d.completedAt,
  ]);
  const minUnix = Math.min(...allTimestamps);
  const maxUnix = Math.max(...allTimestamps);
  const domainMin = minUnix - 86400;
  const domainMax = maxUnix + 86400;

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border-light)"
            vertical={false}
          />
          <XAxis
            type="number"
            dataKey="estimatedAt"
            domain={[domainMin, domainMax]}
            tickFormatter={(u) => format(fromUnixTime(u), "d MMM")}
            tick={{ fontSize: 11, fill: "var(--color-text-sub)" }}
          />
          <YAxis
            type="number"
            dataKey="completedAt"
            domain={[domainMin, domainMax]}
            tickFormatter={(u) => format(fromUnixTime(u), "d MMM")}
            tick={{ fontSize: 11, fill: "var(--color-text-sub)" }}
          />
          <ZAxis type="number" range={[60, 60]} />

          <ReferenceLine
            segment={[
              { x: domainMin, y: domainMin },
              { x: domainMax, y: domainMax },
            ]}
            stroke="var(--color-text-sub)"
            strokeDasharray="5 5"
            label={{
              value: "Perfect Estimate",
              position: "insideTopRight",
              fill: "var(--color-text-sub)",
              fontSize: 11,
              offset: -20,
            }}
          />

          <Scatter name="On Time" data={allTasks} fillOpacity={0.6} />
          <Tooltip<ValueType, NameType>
            cursor={{ strokeDasharray: "3 3" }}
            itemStyle={{ color: "var(--text-text-main)" }}
            content={(args) => {
              if (!args?.payload?.[0]?.payload) return;
              const { title, varianceMinutes } = args.payload[0].payload;
              const absMins = Math.abs(varianceMinutes);
              const status = varianceMinutes >= 0 ? "early" : "late";

              const time =
                absMins >= 1440
                  ? `${(absMins / 1440).toFixed()} days`
                  : absMins >= 60
                    ? `${(absMins / 60).toFixed()} hours`
                    : `${absMins.toFixed()} mins`;

              return (
                <p className="card border border-text-main">{`${title} was completed ${time} ${status} `}</p>
              );
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
