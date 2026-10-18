import type {
  BreakdownResponse,
  DiscoveredPageRow,
  PageRow,
  PagesQuery,
  VisitRow,
} from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { type Rows, visitBreakdown } from "./breakdown-sql.js";
import { type ReportInput, runReport } from "./report.js";
import { eventScope } from "./scope-sql.js";
import type { StatsContext } from "./stats-context.js";

// `GET …/stats/pages?view=` (spec §3.1). top = page views per (hostname, route); entry / exit =
// the first / last page of visits that started in the range; discovered = `pages_seen` rows first
// seen in the range (newest first; filters do not apply, it is not event data).

export type PagesRow = PageRow | VisitRow | DiscoveredPageRow;

async function topPages(sql: Sql, context: StatsContext, limit: number): Promise<Rows<PageRow>> {
  const rows = await sql<PageRow[]>`
    SELECT hostname, route, count(*) FILTER (WHERE browser)::int AS visitors,
           sum(n)::int AS pageviews
    FROM (SELECT e.hostname, e.route, e.visitor_id, e.source = 1 AS browser, count(*) AS n
          FROM events e WHERE ${eventScope(sql, context, context.range)} AND e.type = 1
          GROUP BY 1, 2, 3, 4) AS g
    GROUP BY 1, 2 ORDER BY pageviews DESC, visitors DESC, route LIMIT ${limit + 1}`;
  return { rows: rows.slice(0, limit), truncated: rows.length > limit };
}

async function discovered(sql: Sql, context: StatsContext, limit: number) {
  const rows = await sql<
    {
      hostname: string;
      route: string;
      firstSeenAt: Date;
      lastSeenAt: Date;
      lastTitle: string | null;
    }[]
  >`
    SELECT hostname, route, first_seen_at, last_seen_at, last_title FROM pages_seen
    WHERE project_id = ${context.projectId}
      AND environment_id = ANY(${context.environmentIds}::uuid[])
      AND first_seen_at >= ${context.range.from} AND first_seen_at < ${context.range.to}
    ORDER BY first_seen_at DESC, route LIMIT ${limit + 1}`;
  const mapped = rows.map((r) => ({
    ...r,
    firstSeenAt: r.firstSeenAt.toISOString(),
    lastSeenAt: r.lastSeenAt.toISOString(),
  }));
  return { rows: mapped.slice(0, limit), truncated: rows.length > limit };
}

export function getPages(
  sql: Sql,
  scope: AccessScope,
  input: ReportInput<PagesQuery>,
): Promise<BreakdownResponse<PagesRow>> {
  return runReport<PagesQuery, PagesRow>(sql, scope, input, (tx, context, query) => {
    if (query.view === "top") return topPages(tx, context, query.limit);
    if (query.view === "discovered") return discovered(tx, context, query.limit);
    const column = query.view === "entry" ? "entry_pathname" : "exit_pathname";
    return visitBreakdown(tx, context, {
      dimension: tx`v.${tx(column)}`,
      where: tx`v.${tx(column)} IS NOT NULL`,
      limit: query.limit,
    });
  });
}
