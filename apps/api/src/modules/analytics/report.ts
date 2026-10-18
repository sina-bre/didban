import type { BreakdownResponse, StatsQuery } from "@didban/contracts";
import type { Sql } from "../../db/db.module.js";
import type { AccessScope } from "../../domain/permissions.js";
import type { Rows } from "./breakdown-sql.js";
import { readStats } from "./read-stats.js";
import { loadStatsContext, type StatsContext, statsMeta } from "./stats-context.js";

export type ReportInput<Q extends StatsQuery> = { projectId: string; query: Q };

/** One breakdown request: scope check, context, read-only transaction, `meta.truncated`. */
export function runReport<Q extends StatsQuery, Row>(
  sql: Sql,
  scope: AccessScope,
  input: ReportInput<Q>,
  build: (tx: Sql, context: StatsContext, query: Q) => Promise<Rows<Row>>,
): Promise<BreakdownResponse<Row>> {
  return readStats(sql, async (tx) => {
    const context = await loadStatsContext(tx, scope, input);
    const { rows, truncated } = await build(tx, context, input.query);
    return { meta: { ...statsMeta(context), truncated }, rows };
  });
}
