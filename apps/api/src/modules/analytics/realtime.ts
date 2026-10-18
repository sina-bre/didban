import {
  ACTIVE_MINUTES,
  type LiveQuery,
  REALTIME_MINUTES,
  type RealtimeResponse,
} from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { channelName } from "./labels.js";
import { liveMeta, loadLiveContext } from "./live-context.js";
import { readStats } from "./read-stats.js";
import { eventScope, visitScope } from "./scope-sql.js";
import type { StatsContext } from "./stats-context.js";

// `GET …/stats/realtime` (spec §3.1): the last 30 minutes, never cached (polled every 10 s).

const TYPES = { 1: "page", 2: "track", 3: "identify" } as const;

async function perMinute(sql: Sql, context: StatsContext) {
  const { from, to } = context.range;
  return sql<{ minute: Date; pageviews: number }[]>`
    SELECT m AS minute, count(e.*) FILTER (WHERE e.type = 1)::int AS pageviews
    FROM generate_series(date_trunc('minute', ${from}::timestamptz), ${to}::timestamptz, interval '1 minute') AS m
    LEFT JOIN events e ON ${eventScope(sql, context, context.range)}
      AND e.occurred_at >= m AND e.occurred_at < m + interval '1 minute'
    GROUP BY m ORDER BY m`;
}

async function active(sql: Sql, context: StatsContext) {
  const recent = {
    from: new Date(context.range.to.getTime() - ACTIVE_MINUTES * 60_000),
    to: context.range.to,
  };
  const scope = eventScope(sql, context, recent);
  const [visitors] = await sql<{ n: number }[]>`
    SELECT count(DISTINCT e.visitor_id) FILTER (WHERE e.source = 1)::int AS n FROM events e WHERE ${scope}`;
  const pages = await sql<RealtimeResponse["activePages"]>`
    SELECT e.hostname, e.route, count(DISTINCT e.visitor_id)::int AS visitors
    FROM events e WHERE ${scope} AND e.type = 1 AND e.source = 1
    GROUP BY 1, 2 ORDER BY visitors DESC, e.route LIMIT 10`;
  return { activeVisitors: visitors?.n ?? 0, activePages: [...pages] };
}

export function getRealtime(
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; query: LiveQuery },
): Promise<RealtimeResponse> {
  return readStats(sql, async (tx) => {
    const context = await loadLiveContext(tx, scope, { ...input, minutes: REALTIME_MINUTES });
    const sources = await tx<{ value: string | null; visits: number }[]>`
      SELECT v.channel::text AS value, count(*)::int AS visits FROM visits v
      WHERE ${visitScope(tx, context, context.range)} GROUP BY 1 ORDER BY visits DESC, value LIMIT 10`;
    const recent = await tx<
      { at: Date; type: 1 | 2 | 3; name: string | null; pathname: string; country: string | null }[]
    >`
      SELECT e.occurred_at AS at, e.type, e.name, e.pathname, e.country FROM events e
      WHERE ${eventScope(tx, context, context.range)} ORDER BY e.occurred_at DESC, e.event_id LIMIT 20`;
    return {
      meta: liveMeta(context),
      ...(await active(tx, context)),
      pageviewsPerMinute: (await perMinute(tx, context)).map((r) => ({
        minute: r.minute.toISOString(),
        pageviews: r.pageviews,
      })),
      sources: sources.map((s) => ({ value: channelName(s.value), visits: s.visits })),
      recentEvents: recent.map((r) => ({ ...r, at: r.at.toISOString(), type: TYPES[r.type] })),
    };
  });
}
