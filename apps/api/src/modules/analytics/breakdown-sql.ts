import type { EventRow, VisitRow } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import { toMetrics } from "../../domain/stats-metrics.js";
import { visitAggregates } from "./count-sql.js";
import { eventScope, type Fragment, visitScope } from "./scope-sql.js";
import type { StatsContext } from "./stats-context.js";

// Top-N breakdowns (spec §10: aggregates are not paginated). One extra row tells whether the list
// was cut (`truncated`). Order: visitors, then events/visits, then value, NULL last.

export type Breakdown = {
  /** A column expression from code (never from user input) on alias `e` or `v`. */
  dimension: Fragment;
  /** Extra AND conditions, e.g. `e.type = 2`. */
  where?: Fragment;
  limit: number;
  /** Turns a stored code into its public name (channel, device type, screen class). */
  label?: (raw: string | null) => string | null;
};
export type Rows<Row> = { rows: Row[]; truncated: boolean };

const cut = <Row>(rows: Row[], limit: number): Rows<Row> => ({
  rows: rows.slice(0, limit),
  truncated: rows.length > limit,
});

export async function eventBreakdown(sql: Sql, context: StatsContext, b: Breakdown) {
  const rows = await sql<EventRow[]>`
    SELECT ${b.dimension}::text AS value,
           count(DISTINCT e.visitor_id) FILTER (WHERE e.source = 1)::int AS visitors,
           count(*) FILTER (WHERE e.type = 1)::int AS pageviews,
           count(*)::int AS events
    FROM events e
    WHERE ${eventScope(sql, context, context.range)} ${b.where ? sql`AND ${b.where}` : sql``}
    GROUP BY 1 ORDER BY visitors DESC, events DESC, value ASC NULLS LAST
    LIMIT ${b.limit + 1}`;
  const label = b.label ?? ((raw) => raw);
  return cut(
    rows.map((row) => ({ ...row, value: label(row.value) })),
    b.limit,
  );
}

type VisitCounts = { value: string | null; visitors: number; visits: number; bounces: number };

export async function visitBreakdown(sql: Sql, context: StatsContext, b: Breakdown) {
  const rows = await sql<(VisitCounts & { visitPageviews: string; durationSeconds: number })[]>`
    SELECT ${b.dimension}::text AS value, count(DISTINCT v.visitor_id)::int AS visitors,
           ${visitAggregates(sql)}
    FROM visits v
    WHERE ${visitScope(sql, context, context.range)} ${b.where ? sql`AND ${b.where}` : sql``}
    GROUP BY 1 ORDER BY visitors DESC, visits DESC, value ASC NULLS LAST
    LIMIT ${b.limit + 1}`;
  const label = b.label ?? ((raw) => raw);
  const mapped: VisitRow[] = rows.map((row) => {
    const metrics = toMetrics({
      ...row,
      pageviews: 0,
      visitPageviews: Number(row.visitPageviews),
    });
    return {
      value: label(row.value),
      visitors: row.visitors,
      visits: row.visits,
      bounceRate: metrics.bounceRate,
      visitDuration: metrics.visitDuration,
    };
  });
  return cut(mapped, b.limit);
}
