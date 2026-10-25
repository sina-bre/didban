import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SeriesPoint } from "./time-series-chart";

export interface PlotProps {
  points: readonly SeriesPoint[];
  valueLabel: string;
  dateLabel: string;
  previousLabel: string;
  formatDay: (date: Date) => string;
  formatValue: (value: number) => string;
  /** Mirror the time axis (fa, addendum A4). */
  rtl: boolean;
}

const TICK = { fill: "var(--color-muted)", fontSize: 12 };

const xAxis = (label: string, rtl: boolean) => ({
  dataKey: "day",
  reversed: rtl,
  tick: TICK,
  tickLine: false,
  axisLine: false,
  minTickGap: 24,
  label: { value: label, position: "insideBottom" as const, offset: -12, ...TICK },
});

const yAxis = (label: string, rtl: boolean) => ({
  orientation: rtl ? ("right" as const) : ("left" as const),
  tick: TICK,
  tickLine: false,
  axisLine: false,
  width: 56,
  label: {
    value: label,
    angle: -90,
    position: rtl ? ("insideRight" as const) : ("insideLeft" as const),
    ...TICK,
  },
});

/**
 * Recharts body of TimeSeriesChart, loaded with `lazy()` so Recharts never lands in the initial
 * bundle. Orange area + line, previous period dashed slate, dark tooltip, labeled axes; Recharts'
 * accessibility layer makes the tooltip reachable with the arrow keys.
 */
export default function TimeSeriesPlot(props: PlotProps) {
  const { points, valueLabel, dateLabel, previousLabel, formatDay, formatValue, rtl } = props;
  const data = points.map((p) => ({ ...p, day: formatDay(p.date) }));
  const hasPrevious = points.some((p) => p.previous !== undefined);
  return (
    <ResponsiveContainer width="100%" height={256}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 16, left: 8 }}>
        <defs>
          <linearGradient id="series-1-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-series-1)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--color-series-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--color-line)" strokeDasharray="4 4" />
        <XAxis {...xAxis(dateLabel, rtl)} />
        <YAxis {...yAxis(valueLabel, rtl)} tickFormatter={formatValue} />
        <Tooltip
          formatter={(value, name) => [formatValue(Number(value)), name]}
          contentStyle={{ background: "var(--color-inverse)", border: 0, borderRadius: 12 }}
          labelStyle={{ color: "var(--color-on-inverse)" }}
          itemStyle={{ color: "var(--color-on-inverse)" }}
        />
        {hasPrevious && (
          <Line
            dataKey="previous"
            name={previousLabel}
            stroke="var(--color-series-compare)"
            strokeDasharray="6 4"
            dot={false}
            isAnimationActive={false}
          />
        )}
        <Area
          dataKey="value"
          name={valueLabel}
          stroke="var(--color-series-1)"
          strokeWidth={2}
          fill="url(#series-1-fill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
