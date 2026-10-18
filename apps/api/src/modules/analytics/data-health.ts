import { DATA_HEALTH_DAYS, type DataHealthResponse, type LiveQuery } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import type { RecentRejections } from "../diagnostics/recent-rejections.js";
import { OTHER_ROUTE, PAGES_SEEN_CAP } from "../events/upsert-pages-seen.js";
import { liveMeta, loadLiveContext } from "./live-context.js";
import { readStats } from "./read-stats.js";
import type { StatsContext } from "./stats-context.js";

// `GET …/stats/data-health` (spec §3.1): last event, events per UTC hour for 7 days, rejections
// by code and the rejected origins (flushed from memory once a minute), the `pages_seen` cap,
// and this process's last rejected batches. Filters do not apply: this is about ingestion.

async function eventsPerHour(sql: Sql, c: StatsContext) {
  return sql<{ hour: Date; events: number }[]>`
    SELECT h AS hour, count(e.event_id)::int AS events
    FROM generate_series(date_trunc('hour', ${c.range.from}::timestamptz, 'UTC'),
                         ${c.range.to}::timestamptz, interval '1 hour') AS h
    LEFT JOIN events e ON e.project_id = ${c.projectId}
      AND e.environment_id = ANY(${c.environmentIds}::uuid[])
      AND e.occurred_at >= h AND e.occurred_at < h + interval '1 hour'
    GROUP BY h ORDER BY h`;
}

async function ingestionSide(sql: Sql, c: StatsContext) {
  const envs = sql`project_id = ${c.projectId} AND environment_id = ANY(${c.environmentIds}::uuid[])`;
  const rejections = await sql<{ code: string; count: number }[]>`
    SELECT code, sum(count)::int AS count FROM ingestion_diagnostics
    WHERE ${envs} AND hour >= ${c.range.from} GROUP BY code ORDER BY count DESC, code`;
  const origins = await sql<{ origin: string; count: number; lastSeenAt: Date }[]>`
    SELECT origin, sum(count)::int AS count, max(last_seen_at) AS last_seen_at
    FROM ingestion_rejected_origins
    WHERE ${envs} AND day >= (${c.range.from}::timestamptz AT TIME ZONE 'UTC')::date
    GROUP BY origin ORDER BY count DESC, origin LIMIT 20`;
  const [pages] = await sql<{ count: number; overflowing: boolean }[]>`
    SELECT count(*)::int AS count, coalesce(bool_or(route = ${OTHER_ROUTE}), false) AS overflowing
    FROM pages_seen WHERE ${envs}`;
  return {
    rejections: [...rejections],
    rejectedOrigins: origins.map((o) => ({ ...o, lastSeenAt: o.lastSeenAt.toISOString() })),
    pagesSeen: {
      count: pages?.count ?? 0,
      cap: PAGES_SEEN_CAP,
      overflowing: pages?.overflowing ?? false,
    },
  };
}

export function getDataHealth(
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; query: LiveQuery; recent: RecentRejections },
): Promise<DataHealthResponse> {
  return readStats(sql, async (tx) => {
    const minutes = DATA_HEALTH_DAYS * 24 * 60;
    const context = await loadLiveContext(tx, scope, { ...input, minutes });
    const [last] = await tx<{ at: Date | null }[]>`
      SELECT max(occurred_at) AS at FROM events
      WHERE project_id = ${context.projectId} AND environment_id = ANY(${context.environmentIds}::uuid[])`;
    const hours = await eventsPerHour(tx, context);
    return {
      meta: liveMeta(context),
      lastEventAt: last?.at?.toISOString() ?? null,
      eventsPerHour: hours.map((h) => ({ hour: h.hour.toISOString(), events: h.events })),
      ...(await ingestionSide(tx, context)),
      recentRejections: input.recent.list(context.environmentIds),
    };
  });
}
