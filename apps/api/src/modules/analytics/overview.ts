import type { OverviewResponse, StatsQuery } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import { EMPTY_COUNTS, toMetrics, withChanges } from "../../domain/stats-metrics.js";
import type { Range } from "../../domain/stats-range.js";
import { countRange } from "./count-sql.js";
import { readStats } from "./read-stats.js";
import { loadStatsContext, type StatsContext, statsMeta } from "./stats-context.js";

// `GET …/stats/overview` (spec §3.1): six KPIs for the range, totals as range-distinct counts
// (never bucket sums), plus the comparison range when asked.

async function totals(sql: Sql, context: StatsContext, range: Range) {
  const [row] = await countRange(sql, { context, range, bucket: null });
  return toMetrics(row ?? EMPTY_COUNTS);
}

export function getOverview(
  sql: Sql,
  scope: AccessScope,
  input: { projectId: string; query: StatsQuery },
): Promise<OverviewResponse> {
  return readStats(sql, async (tx) => {
    const context = await loadStatsContext(tx, scope, input);
    const current = await totals(tx, context, context.range);
    const previous = context.previous ? await totals(tx, context, context.previous) : null;
    return { meta: statsMeta(context), metrics: withChanges(current, previous) };
  });
}
