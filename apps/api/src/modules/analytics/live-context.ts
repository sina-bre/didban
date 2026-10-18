import type { LiveMeta, LiveQuery } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { loadStatsContext, type StatsContext } from "./stats-context.js";

// Realtime and Data Health read a fixed window ending now instead of `from`/`to`; the rest of the
// context (scope check, environments, time zone) is the same as for every stats query.

export async function loadLiveContext(
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; query: LiveQuery; minutes: number },
): Promise<StatsContext> {
  const to = new Date();
  const from = new Date(to.getTime() - input.minutes * 60_000);
  const query = {
    from,
    to,
    interval: "auto" as const,
    compare: "none" as const,
    filter: [],
    ...(input.query.environmentId ? { environmentId: input.query.environmentId } : {}),
  };
  return loadStatsContext(sql, scope, { projectId: input.projectId, query });
}

export function liveMeta(context: StatsContext): LiveMeta {
  return {
    from: context.range.from.toISOString(),
    to: context.range.to.toISOString(),
    timezone: context.timezone,
    identityMode: context.identityMode,
    generatedAt: new Date().toISOString(),
  };
}
