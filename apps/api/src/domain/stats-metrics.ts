import type { MetricWithChange, OverviewMetric, OverviewMetrics } from "@didban/contracts";

// Spec §4 metric definitions on top of raw counts. Pure: no SQL, no HTTP.

/** What the queries return for one range or one bucket. */
export type RawCounts = {
  visitors: number;
  pageviews: number;
  visits: number;
  bounces: number;
  /** Sum of visit pageviews and durations (seconds) over the counted visits. */
  visitPageviews: number;
  durationSeconds: number;
};

export const EMPTY_COUNTS: RawCounts = {
  visitors: 0,
  pageviews: 0,
  visits: 0,
  bounces: 0,
  visitPageviews: 0,
  durationSeconds: 0,
};

const ratio = (part: number, whole: number) => (whole === 0 ? null : part / whole);
const round = (value: number | null, digits: number) =>
  value === null ? null : Number(value.toFixed(digits));

/** Rates 0–1 (4 decimals), duration in seconds (1 decimal); `null` when there are no visits. */
export function toMetrics(c: RawCounts): OverviewMetrics {
  return {
    visitors: c.visitors,
    visits: c.visits,
    pageviews: c.pageviews,
    viewsPerVisit: round(ratio(c.visitPageviews, c.visits), 2),
    bounceRate: round(ratio(c.bounces, c.visits), 4),
    visitDuration: round(ratio(c.durationSeconds, c.visits), 1),
  };
}

/** Percent change, 1 decimal; `null` (not 0, not ∞) when the previous value is 0 or missing. */
export function percentChange(value: number | null, previous: number | null): number | null {
  if (value === null || previous === null || previous === 0) return null;
  return round(((value - previous) / previous) * 100, 1);
}

export function withChanges(
  current: OverviewMetrics,
  previous: OverviewMetrics | null,
): Record<OverviewMetric, MetricWithChange> {
  const keys = Object.keys(current) as OverviewMetric[];
  return Object.fromEntries(
    keys.map((key) => {
      const before = previous ? previous[key] : null;
      return [
        key,
        { value: current[key], previous: before, change: percentChange(current[key], before) },
      ];
    }),
  ) as Record<OverviewMetric, MetricWithChange>;
}
