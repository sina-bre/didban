import type postgres from "postgres";
import type { Sql } from "../../db/db.module.js";
import type { Range } from "../../domain/stats-range.js";
import { filterSql } from "./filter-sql.js";
import type { StatsContext } from "./stats-context.js";

// The WHERE clauses every stats query shares. Events (alias `e`): project, environments,
// `[from, to)` on `occurred_at`, all filters. Visits (alias `v`): started in the range; with
// filters, only visits that contain a matching event (spec §4 via ADR 0033).

export type Fragment = postgres.PendingQuery<postgres.Row[]>;

export function eventScope(sql: Sql, context: StatsContext, range: Range): Fragment {
  return sql`e.project_id = ${context.projectId}
    AND e.environment_id = ANY(${context.environmentIds}::uuid[])
    AND e.occurred_at >= ${range.from} AND e.occurred_at < ${range.to}
    ${filterSql(sql, context.query.filter)}`;
}

export function visitScope(sql: Sql, context: StatsContext, range: Range): Fragment {
  const matching =
    context.query.filter.length === 0
      ? sql``
      : sql`AND v.visit_id IN (SELECT e.visit_id FROM events e
              WHERE ${eventScope(sql, context, range)} AND e.visit_id IS NOT NULL)`;
  return sql`v.project_id = ${context.projectId}
    AND v.environment_id = ANY(${context.environmentIds}::uuid[])
    AND v.started_at >= ${range.from} AND v.started_at < ${range.to} ${matching}`;
}
