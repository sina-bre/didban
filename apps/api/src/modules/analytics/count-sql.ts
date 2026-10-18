import type { StatsInterval } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { RawCounts } from "../../domain/stats-metrics.js";
import type { Range } from "../../domain/stats-range.js";
import { eventScope, visitScope } from "./scope-sql.js";
import type { StatsContext } from "./stats-context.js";

// Spec §4 counts for one range, either as one total row (`bucket` = null) or one row per bucket of
// the reporting time zone (`date_trunc(unit, ts, tz)`: DST-correct, PostgreSQL ≥ 16).
// Events: visitors = distinct browser visitor IDs, page views = all `page` events (both sources).
// Visits: see scope-sql.ts.

export type CountRow = RawCounts & { start: Date | null };
type Counts = { context: StatsContext; range: Range; bucket: StatsInterval | null };

/** Visit counts behind visits, bounce rate, views per visit and duration (alias `v`). */
export const visitAggregates = (sql: Sql) => sql`
  count(*)::int AS visits,
  count(*) FILTER (WHERE v.pageviews = 1 AND v.events = 1)::int AS bounces,
  coalesce(sum(v.pageviews), 0)::int8 AS visit_pageviews,
  coalesce(sum(GREATEST(extract(epoch FROM v.last_seen_at - v.started_at),
                        coalesce(v.engaged_ms, 0) / 1000.0)), 0)::float8 AS duration_seconds`;

export async function countRange(sql: Sql, input: Counts): Promise<CountRow[]> {
  const { context, range, bucket } = input;
  const tz = context.timezone;
  const eventBucket = bucket ? sql`date_trunc(${bucket}, e.occurred_at, ${tz})` : sql`NULL`;
  const visitBucket = bucket ? sql`date_trunc(${bucket}, v.started_at, ${tz})` : sql`NULL`;
  const [events, visits] = await Promise.all([
    sql<{ start: Date | null; visitors: number; pageviews: number }[]>`
      SELECT ${eventBucket}::timestamptz AS start,
             count(DISTINCT e.visitor_id) FILTER (WHERE e.source = 1)::int AS visitors,
             count(*) FILTER (WHERE e.type = 1)::int AS pageviews
      FROM events e WHERE ${eventScope(sql, context, range)} GROUP BY 1`,
    sql<Omit<CountRow, "visitors" | "pageviews">[]>`
      SELECT ${visitBucket}::timestamptz AS start, ${visitAggregates(sql)}
      FROM visits v WHERE ${visitScope(sql, context, range)} GROUP BY 1`,
  ]);
  return merge(events, visits);
}

function merge(
  events: { start: Date | null; visitors: number; pageviews: number }[],
  visits: Omit<CountRow, "visitors" | "pageviews">[],
): CountRow[] {
  const key = (start: Date | null) => start?.toISOString() ?? "total";
  const rows = new Map<string, CountRow>();
  const row = (start: Date | null) => {
    const existing = rows.get(key(start));
    if (existing) return existing;
    const fresh: CountRow = {
      start,
      visitors: 0,
      pageviews: 0,
      visits: 0,
      bounces: 0,
      visitPageviews: 0,
      durationSeconds: 0,
    };
    rows.set(key(start), fresh);
    return fresh;
  };
  for (const e of events)
    Object.assign(row(e.start), { visitors: e.visitors, pageviews: e.pageviews });
  for (const v of visits) {
    Object.assign(row(v.start), {
      visits: v.visits,
      bounces: v.bounces,
      visitPageviews: Number(v.visitPageviews),
      durationSeconds: v.durationSeconds,
    });
  }
  return [...rows.values()];
}
