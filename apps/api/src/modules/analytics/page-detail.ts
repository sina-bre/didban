import type { PageDetailQuery, PageDetailResponse } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { countRange } from "./count-sql.js";
import { readStats } from "./read-stats.js";
import type { ReportInput } from "./report.js";
import { eventScope } from "./scope-sql.js";
import { loadStatsContext, type StatsContext, statsMeta } from "./stats-context.js";

// `GET …/stats/pages/detail?hostname=&route=`: the page's visitors and views, plus the scroll
// depth and engaged time modules' events on it (catalog 23.2; `null` = the module sent nothing).
// Only numeric property values count, so a malformed client cannot break the cast.

function forPage(context: StatsContext, hostname: string, route: string): StatsContext {
  const page = [
    { field: "hostname" as const, op: "eq" as const, values: [hostname] },
    { field: "route" as const, op: "eq" as const, values: [route] },
  ];
  return { ...context, query: { ...context.query, filter: [...context.query.filter, ...page] } };
}

async function moduleStats(sql: Sql, context: StatsContext) {
  const scope = eventScope(sql, context, context.range);
  const scroll = await sql<{ percent: number; visitors: number }[]>`
    SELECT percent, count(*)::int AS visitors
    FROM (SELECT round((e.properties ->> 'percent')::numeric)::int AS percent, e.visitor_id
          FROM events e
          WHERE ${scope} AND e.type = 2 AND e.name = 'scroll_depth'
            AND jsonb_typeof(e.properties -> 'percent') = 'number'
          GROUP BY 1, 2) AS s
    GROUP BY 1 ORDER BY 1`;
  const [engaged] = await sql<{ seconds: number | null }[]>`
    SELECT round(avg((e.properties ->> 'seconds')::numeric), 1)::float8 AS seconds
    FROM events e
    WHERE ${scope} AND e.type = 2 AND e.name = 'engaged_time'
      AND jsonb_typeof(e.properties -> 'seconds') = 'number'`;
  return { scrollDepth: scroll.length ? scroll : null, engagedSeconds: engaged?.seconds ?? null };
}

export function getPageDetail(
  sql: Sql,
  scope: AccessScope,
  input: ReportInput<PageDetailQuery>,
): Promise<PageDetailResponse> {
  return readStats(sql, async (tx) => {
    const base = await loadStatsContext(tx, scope, input);
    const context = forPage(base, input.query.hostname, input.query.route);
    const [totals] = await countRange(tx, { context, range: context.range, bucket: null });
    return {
      meta: statsMeta(base),
      visitors: totals?.visitors ?? 0,
      pageviews: totals?.pageviews ?? 0,
      ...(await moduleStats(tx, context)),
    };
  });
}
