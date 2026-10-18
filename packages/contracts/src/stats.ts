import { z } from "zod";
import { MAX_FILTERS, parseFilter, type StatsFilter } from "./stats-filters.js";

// Spec §10 common query parameters for `/projects/:projectId/stats/*`. Query strings arrive as
// strings; a repeated `filter` arrives as an array.
export const MAX_RANGE_DAYS = 366;
export const STATS_INTERVALS = ["auto", "hour", "day", "week", "month"] as const;
export type StatsInterval = Exclude<(typeof STATS_INTERVALS)[number], "auto">;
export const STATS_COMPARE = ["none", "previous_period", "previous_year"] as const;
export type StatsCompare = (typeof STATS_COMPARE)[number];

const instant = z.iso.datetime({ offset: false }).transform((value) => new Date(value));

export const statsQuerySchema = z
  .object({
    from: instant,
    to: instant,
    interval: z.enum(STATS_INTERVALS).default("auto"),
    compare: z.enum(STATS_COMPARE).default("none"),
    filter: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((value) => (value === undefined ? [] : [value].flat()))
      .pipe(z.array(z.string()).max(MAX_FILTERS))
      .transform((list, ctx) => {
        const parsed = list.map(parseFilter);
        if (parsed.some((f) => f === null)) ctx.addIssue({ code: "custom", message: "bad filter" });
        return parsed.filter((f): f is StatsFilter => f !== null);
      }),
    environmentId: z.uuid().optional(),
  })
  .superRefine((q, ctx) => {
    // Zod 4 runs this even when a field failed: only compare two real dates.
    if (!(q.from instanceof Date) || !(q.to instanceof Date)) return;
    const span = q.to.getTime() - q.from.getTime();
    if (span <= 0)
      ctx.addIssue({ code: "custom", path: ["to"], message: "`from` must be before `to`" });
    if (span > MAX_RANGE_DAYS * 86_400_000) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: `range is at most ${MAX_RANGE_DAYS} days`,
      });
    }
  });
export type StatsQuery = z.output<typeof statsQuerySchema>;

export type IdentityModeMeta = "cookieless" | "persistent" | "mixed";

/** Spec §10: every stats response carries this. Instants are ISO-8601 UTC. */
export type StatsMeta = {
  from: string;
  to: string;
  interval: StatsInterval;
  timezone: string;
  compare: StatsCompare;
  /** The previous range when `compare` is not `none`. */
  previous: { from: string; to: string } | null;
  identityMode: IdentityModeMeta;
  truncated: boolean;
  generatedAt: string;
};

/** Spec §3.1 overview KPIs. Rates are 0–1, durations in seconds; `null` = nothing to divide by. */
export type OverviewMetrics = {
  visitors: number;
  visits: number;
  pageviews: number;
  viewsPerVisit: number | null;
  bounceRate: number | null;
  visitDuration: number | null;
};
export type OverviewMetric = keyof OverviewMetrics;

/** `change` in percent; `null` when there is no previous value or it is 0 (spec §4). */
export type MetricWithChange = {
  value: number | null;
  previous: number | null;
  change: number | null;
};

export type OverviewResponse = {
  meta: StatsMeta;
  metrics: Record<OverviewMetric, MetricWithChange>;
};

/** One bucket; `start` is the bucket's first instant (local bucket start in UTC). */
export type TimeseriesPoint = OverviewMetrics & { start: string };

export type TimeseriesResponse = {
  meta: StatsMeta;
  points: TimeseriesPoint[];
  /** Same number of buckets, aligned by index; `null` when `compare=none`. */
  previous: TimeseriesPoint[] | null;
};
