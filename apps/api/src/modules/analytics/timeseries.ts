import type { StatsQuery, TimeseriesPoint, TimeseriesResponse } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { EMPTY_COUNTS, toMetrics } from "../../domain/stats-metrics.js";
import type { Range } from "../../domain/stats-range.js";
import { countRange } from "./count-sql.js";
import { readStats } from "./read-stats.js";
import { loadStatsContext, type StatsContext, statsMeta } from "./stats-context.js";

// `GET …/stats/timeseries`: one point per bucket of the reporting time zone, empty buckets
// included. The bucket list comes from PostgreSQL (`generate_series` in the zone), so days are
// 23 or 25 hours long across DST and half-hour zones start their days at :30 UTC.

async function buckets(sql: Sql, context: StatsContext, range: Range): Promise<Date[]> {
  const { interval, timezone } = context;
  const rows = await sql<{ start: Date }[]>`
    SELECT generate_series(date_trunc(${interval}, ${range.from}::timestamptz, ${timezone}),
                           ${range.to}::timestamptz - interval '1 microsecond',
                           ${`1 ${interval}`}::interval, ${timezone}) AS start`;
  return rows.map((row) => row.start);
}

async function series(sql: Sql, context: StatsContext, range: Range): Promise<TimeseriesPoint[]> {
  const starts = await buckets(sql, context, range);
  const rows = await countRange(sql, { context, range, bucket: context.interval });
  const byStart = new Map(rows.map((row) => [row.start?.toISOString(), row]));
  return starts.map((start) => {
    const iso = start.toISOString();
    return { start: iso, ...toMetrics(byStart.get(iso) ?? EMPTY_COUNTS) };
  });
}

export function getTimeseries(
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; query: StatsQuery },
): Promise<TimeseriesResponse> {
  return readStats(sql, async (tx) => {
    const context = await loadStatsContext(tx, scope, input);
    const points = await series(tx, context, context.range);
    const previous = context.previous ? await series(tx, context, context.previous) : null;
    return { meta: statsMeta(context), points, previous };
  });
}
